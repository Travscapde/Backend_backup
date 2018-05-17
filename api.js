var express = require('express');
var router = express.Router();
var multer = require('multer');
var multerS3 = require('multer-s3')
var AWS = require('aws-sdk');

var winston = require('winston');

var mongoose = require('mongoose');
var UserInfo = require('./models/user_info');
var Card = require('./models/card');
var SessionCards = require('./models/session_cards');
var LocationInfo = require('./models/location_info');
var CardFunctions = require('./cardFunctions.js');
var gatherLocationInfo = require('./gatherLocationInfo.js');
var getLocationScore = require('./gatherWeatherInfo.js');
var fs = require('fs');
var http = require("http");
var https = require("https");
var URL = require('url-parse');
var request = require('request');
var imagesize = require('imagesize');
var requestImageSize  = require('request-image-size');
var password = require('password-hash-and-salt');

//var jsdom = require("node-jsdom");
const jsdom = require("jsdom");
const JSDOM = jsdom.JSDOM
;


var dummy = require('./dummy.js');
var dummyInstance = new dummy();

//setup logger
var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)(),
        new (winston.transports.File)({ filename: './logs/routes.log' })
    ]
});

// middleware that is specific to this router
router.use(function timeLog(req, res, next) {
    logger.info(req.originalUrl);
    next();
});

// define the home page route
router.get('/', function (req, res) {
    res.json({ 'message': 'Travent API home  Hassan' });
});

// define the about route
router.get('/about', function (req, res) {
    res.json({ 'message': 'Welcome to TravnetDiscover Backend!' });
});

/*router.get("/getImages", function (req, res) {
    res.json(dummyInstance.getImages());
});

router.get("/getImage", function (req, res) {
    res.json(dummyInstance.getImage());
});
*/


router.post("/getLinkPreview", function (req, res) {
    var link = req.body.link;
    console.log(link);

    request({uri: link}, function(err, response, body){
        const dom = new JSDOM(body);
        var preview = {
            title: "",
            extract: "",
            image: [],
        };
        preview.title = dom.window.document.querySelector("title").textContent;
        preview.extract = dom.window.document.querySelector("p").textContent;

        console.log(dom.window.document.querySelector("title").textContent);
        console.log(dom.window.document.querySelector("p").textContent);

        var domainName = new URL(link).origin;
        console.log(domainName);
        var imgUrls = dom.window.document.querySelectorAll("img");

        getLargeImage(0);

        function getLargeImage(idx) {
            if (idx >= imgUrls.length) {
                res.json(preview);
                return;
            }

            imgUrl = imgUrls[idx].src;

            //Handle relative paths
            if(imgUrl.indexOf('http') == -1 && imgUrl.indexOf('.com') == -1) {
                imgUrl = domainName + '/' + imgUrl;
            }
            //console.log(imgUrl);


            try {
                if(imgUrl.substring(0, 5) == "https") {
                    var req = https.get(imgUrl, responseHandler);
                } else if (imgUrl.substring(0, 4) == "http") {
                    var req = http.get(imgUrl, responseHandler);
                }

                req.on('error', function(err) {
                    console.log("Error in http request");
                    req.end();
                    getLargeImage(idx+1);
                });

            } catch(e) {
                getLargeImage(idx+1);
                console.log(e);
            }


            function responseHandler(response) {
                imagesize(response, function (err, result) {
                    if (err || !(result)) {
                        getLargeImage(idx+1);
                    } else if(result && result.width > 720 && result.height > 540) {
                        preview.image.push(imgUrl);
                        if(preview.image.length == 3) {
                            res.json(preview);
                        } else {
                            getLargeImage(idx+1);
                        }
                    } else {
                        getLargeImage(idx+1);
                    }
                    // we don't need more data
                    req.abort();
                });
            }


        }

        /*var request = http.get(imgUrl, function (response) {
          imagesize(response, function (err, result) {
            console.log(result);
            // we don't need more data
            request.abort();
          });
        });*/
    });

    /*jsdom.env(
      "http://nodejs.org/dist/",
      ["http://code.jquery.com/jquery.js"],
      function (errors, window) {
        console.log("there have been", window.$("a").length, "nodejs releases!");
      }
    );*/





});


router.get("/getCards", function (req, res) {
    Card.find({}).sort({ created_at: 'desc' }).exec(function (err, cards) {
        res.json({ "cards": cards });
    });
});




function fetchCards(userID, location, latitude, longitude, callback) {
    Card.find().populate('user_info_id').lean().exec(function (err, cards) {
        if (err) {
            console.log(err);
            callback({ "message": "unable to fetch cards" });
        } else {

            UserInfo.find({"_id" : userID}, function(err, users) {
                if (err) {
                    console.log(err);
                    callback({ "message": "unable to fetch user" });
                } else {
                    /*cards.forEach(function(card) {
                        if(card.user_name != card.user_info_id.name || card.user_profile_pic != card.user_info_id.profile_pic) {
                            card.user_name = card.user_info_id.name;
                            card.user_profile_pic = card.user_info_id.profile_pic;
                            card.save();
                        }
                    });*/

                    var sortedCards = CardFunctions.ranker(cards, users[0], latitude, longitude);
                    //console.log(sortedCards.length);
                    CardFunctions.addInfo(sortedCards, users[0], latitude, longitude, 0, function(finalCards, idx) {
                        callback({ "cards": finalCards });
                    });

                }

            });


        }
    })
}




router.post("/getCards", function (req, res) {
    //console.log(req.body.latitude);
    //console.log(req.body.longitude);

    if(!('user_id' in req.body)) {
        res.json({"message": "No User ID"})
    }

    //Existing session
    if('start_idx' in req.body) {
        if(parseInt(req.body.start_idx) == 0) {
            fetchCards(req.body.user_id, null, req.body.latitude, req.body.longitude, function(resultObj) {
                if('cards' in resultObj) {
                    var newSessionCards = SessionCards({
                        user_id: req.body.user_id,
                    });
                    resultObj.cards.forEach(function(element) {
                        newSessionCards.sorted_cards.push(element);
                    });
                    SessionCards.findOne({'user_id': req.body.user_id}, function(err, session) {
                        if(session) {
                            session.remove();
                        }
                        newSessionCards.save();
                    });
                    registerSeenCards(req.body.user_id, resultObj.cards.slice(0,10));
                    res.json({"cards": resultObj.cards.slice(0,10)});
                } else {
                    res.json(resultObj);
                }
            });
        } else {
            var idx = req.body.start_idx;
            SessionCards.findOne({'user_id': req.body.user_id}).populate('sorted_cards').lean().exec(function(err, session) {
                if(err || !session) {
                    res.json({"message": "Session Expired"});
                } else {
                    UserInfo.find({"_id" : req.body.user_id}, function(err, users) {
                        if (err) {
                            console.log(err);
                            callback({ "message": "unable to fetch user" });
                        } else {
                            var rawCards = session.sorted_cards.slice(idx, idx+10);
                            CardFunctions.addInfo(rawCards, users[0], req.body.latitude, req.body.longitude, 0, function(finalCards, idx) {
                                registerSeenCards(req.body.user_id, finalCards);
                                res.json({ "cards": finalCards });
                            });
                        }
                    });
                }
            });

        }
    } else {
        fetchCards(req.body.user_id, null, req.body.latitude, req.body.longitude, function(resultObj) {
            registerSeenCards(req.body.user_id, resultObj);
            res.json(resultObj);
        });
    }


    /*Card.find().lean().exec(function (err, cards) {
        if (err) {
            console.log(err);
            res.json({ "message": "unable to fetch cards" });
        } else {
            if (typeof req.body.user_id == 'undefined') {
                console.log("No User ID");
                res.json({ "cards": cards });
            } else {
                UserInfo.find({"_id" : req.body.user_id}, function(err, users) {
                    if (err) {
                        console.log(err);
                        res.json({ "message": "unable to fetch user" });
                    } else {
                        var sortedCards = CardFunctions.ranker(cards, users[0], req.body.location);
                        //console.log(sortedCards.length);
                        CardFunctions.addInfo(sortedCards, users[0], req.body.latitude, req.body.longitude, 0, function(finalCards, idx) {
                            res.json({ "cards": finalCards });
                        });

                    }

                });
            }

        }
    })*/
});





router.post("/search", function (req, res) {
    console.log(req.body.location.split(',')[0]);

    Card.find().lean().exec(function (err, cards) {
        if (err) {
            console.log(err);
            res.json({ "message": "unable to fetch cards" });
        } else {
            if (typeof req.body.user_id == 'undefined') {
                console.log("No User ID");
                res.json({ "cards": cards });
            } else {
                UserInfo.find({"_id" : req.body.user_id}, function(err, users) {
                    if (err) {
                        console.log(err);
                        res.json({ "message": "unable to fetch user" });
                    } else {
                        var searchedCards = CardFunctions.searchByLocation(cards, req.body.location.split(',')[0]);
                        var sortedCards = CardFunctions.ranker(searchedCards, users[0], req.body.location);
                        //console.log(sortedCards.length);
                        CardFunctions.addInfo(sortedCards, users[0], req.body.latitude, req.body.longitude, 0, function(finalCards, idx) {
                            res.json({ "cards": finalCards });
                        });

                    }

                });
            }
        }
    })
});





router.get("/getSecretKey", function (req, res) {
    var file = __dirname + '/aws.json';
    res.sendFile(file);
});

router.get("/getInterests", function (req, res) {

    res.json({
        "interests": [
            { "interest": "Art/Culture" },
            { "interest": "Aerial view" },
            { "interest": "Architecture" },
            { "interest": "Biking" },
            { "interest": "Boat Ride" },
            { "interest": "Hiking" },
            { "interest": "Diving" },
            { "interest": "Camping" },
            { "interest": "Caving" },
            { "interest": "Cruise" },
            { "interest": "Cycling" },
            { "interest": "Desert" },
            { "interest": "Festival" },
            { "interest": "Fishing" },
            { "interest": "Foodie" },
            { "interest": "Heritage" },
            { "interest": "Kayaking" },
            { "interest": "Lake" },
            { "interest": "Landscape" },
            { "interest": "Massage" },
            { "interest": "Mountain" },
            { "interest": "Party" },
            { "interest": "Road Trip" },
            { "interest": "Sailing" },
            { "interest": "Sea Beach" },
            { "interest": "Snorkelling" },
            { "interest": "Surfing" },
            { "interest": "Thrill" },
            { "interest": "Train Ride" },
            { "interest": "Trekking" },
            { "interest": "Winter Sports" },
            { "interest": "Water Sports" },
            { "interest": "Waterfall" },
            { "interest": "Wildlife" },
            { "interest": "Yoga" },
            { "interest": "Others" }]
    });
});

router.post("/getUserInfo", function (req, res) {
    UserInfo.findById(req.body.user_id, function (err, searchedUser) {
        if (err) {
            res.json({ "message": "user not found" });
        } else {
            res.json(searchedUser);
        }
    });
});

router.post("/getUserPhotoCount", function (req, res) {
    UserInfo.findById(req.body.user_id, function (err, searchedUser) {
        if (err) {
            res.json({ "message": "user not found" });
        } else {
            //found user
            var count = searchedUser.photo_count;
            res.json({ "count": count });
        }
    });
});

/*router.post("/likeCard", function (req, res) {
    Card.findById(req.body.card_id, function (err, searchedCard) {
        if (!searchedCard) {
            res.json({ 'message': 'card_id not found' });
            return 0;
        } else {
            //check if user_id exists before adding
            searchedCard.like_list.push(req.body.user_id);
            searchedCard.likes = searchedCard.likes + 1;
            searchedCard.save();
            res.json(searchedCard);
        }
    });
});*/


router.post("/likeCard", function (req, res) {
    //console.log(req.body);
    UserInfo.findById(req.body.user_id, function (err, searchedUser) {
        if (!searchedUser) {
            res.json({ 'message': 'user_id not found' });
            return 0;
        } else {
            Card.findById(req.body.card_id, function (err, searchedCard) {
                if (!searchedCard) {
                    res.json({ 'message': 'card_id not found' });
                    return 0;
                } else {
                    UserInfo.findById(searchedCard.user_info_id, function (err, uploader) {
                        uploader.likes_received++;
                        uploader.save();
                    });

                    searchedCard.likes = searchedCard.likes + 1;
                    searchedCard.save();
                    searchedUser.like_list.push(req.body.card_id);
                    searchedUser.save();
                    res.json(searchedCard);
                }
            });


        }
    });


});


function registerSeenCards(userID, cards) {
    console.log(userID);
    console.log(cards);
    UserInfo.findById(userID, function (err, searchedUser) {
        if (!searchedUser) {
            console.log("user not found");
            return;
        } else {
            var i;
            for (i=0;i<cards.length;i++) {
                var id = cards[i]._id;
                if (searchedUser.seen_list.indexOf(id) > -1) {
                } else {
                    searchedUser.seen_list.push(id);
                    Card.findById(id, function(err, searchedCard) {
                        searchedCard.seen_count++;
                        searchedCard.save();
                    });
                }
            }

            searchedUser.save();
        }
    });
}



router.post("/seenCard", function (req, res) {
    //console.log(req.body);
    UserInfo.findById(req.body.user_id, function (err, searchedUser) {
        if (!searchedUser) {
            res.json({ 'message': 'user_id not found' });
            return 0;
        } else {
            var cards = (req.body.cards);
            console.log(cards.length);
            var i;
            for (i=0;i<cards.length;i++) {
                var id = cards[i];
                //console.log(id);
                if (searchedUser.seen_list.indexOf(id) > -1) {
                    //console.log("duplicate");
                } else {
                    searchedUser.seen_list.push(id);
                    Card.findById(id, function(err, searchedCard) {
                        searchedCard.seen_count++;
                        searchedCard.save();
                    });
                }
            }

            searchedUser.save();
            res.json(searchedUser);
        }
    });


});




router.post("/addToBucket", function (req, res) {
    Card.findById(req.body.card_id, function (err, searchedCard) {
        if (!searchedCard) {
            res.json({ 'message': 'card_id not found' });
            return 0;
        } else {
            UserInfo.findById(req.body.user_id, function (err, searchedUser) {
                if (!searchedUser)
                    res.json('user_id not found');
                else {

                    UserInfo.findById(searchedCard.user_info_id, function (err, uploader) {
                        uploader.bl_received++;
                        uploader.save();
                    });

                    var locationList = searchedCard.location.split(',');
                    var country = locationList[locationList.length-1].trim();
                    var found = 0;

                    for(var i=0;i<searchedUser.bucket_list.length;i++) {
                        var bucketListItem = searchedUser.bucket_list[i];
                        if (bucketListItem.name == country) {
                            bucketListItem.cards.push(searchedCard._id);
                            searchedUser.save();
                            found = 1;
                            break;
                        }
                    }

                    if(found == 0) {
                        searchedUser.bucket_list.push({name: country, cards: [searchedCard._id]});
                        searchedUser.save();
                    }



                    //searchedUser.bucket_list.push(req.body.card_id);
                    //searchedCard.bucket_users.push(req.body.user_id);
                    searchedCard.bucket_count = searchedCard.bucket_count + 1;
                    searchedCard.save();
                    //searchedUser.save();
                    res.json(searchedCard);
                }
            });
        }
    });
});




router.post("/getBucketList", function (req, res) {
      var options = {
            path: 'bucket_list.cards',
            model: 'Card'
        };

    UserInfo.findById(req.body.user_id).lean().populate(options).exec(function (err, populatedUser) {
        if (!populatedUser) {
            res.json({ 'message': 'user_id not found' });
            return 0;
        } else {
            var count = 0;
            for(var i=0;i<populatedUser.bucket_list.length;i++) {
                var uniqueCards = populatedUser.bucket_list[i].cards.filter(function(elem, index, self) {
                    return index == self.indexOf(elem);
                })

                //populatedUser.bucket_list[i].cards.visa_info = "";
                //console.log((populatedUser.bucket_list[i].cards));
                CardFunctions.addInfo(uniqueCards, populatedUser, 500, 500, i, function(updatedCards, idx) {
                    //console.log(updatedCards);
                    populatedUser.bucket_list[idx].cards = updatedCards;
                    count++;
                    if(count == populatedUser.bucket_list.length) {
                        res.json({"bucket_list": populatedUser.bucket_list});

                    }


                });

            }

        }

    });
});




/*router.post("/getBucketList", function (req, res) {
    UserInfo.findById(req.body.user_id).lean().exec(function (err, searchedUser) {
        if (!searchedUser) {
            res.json({ 'message': 'user_id not found' });
            return 0;
        } else {
            var options = {
                path: 'bucket_list.cards',
                model: 'Card'
            };

            UserInfo.populate(searchedUser, options, function(err, userDoc) {
                if(err) {
                    console.log(err);
                } else {
                    var populatedUser = userDoc.toObject();
                    var count = 0;
                    for(var i=0;i<populatedUser.bucket_list.length;i++) {
                        populatedUser.bucket_list[i].cards.visa_info = "";
                        console.log((populatedUser.bucket_list[i].cards));
                        CardFunctions.addInfo(populatedUser.bucket_list[i].cards, searchedUser, 500, 500, i, function(updatedCards, idx) {
                            //console.log(updatedCards);
                            populatedUser.bucket_list[idx].cards = updatedCards;
                            count++;
                            if(count == populatedUser.bucket_list.length) {
                                res.json({"bucket_list": populatedUser.bucket_list});

                            }


                        });

                    }

                }
            })




        }
    });
});*/


router.post("/getUserInfo", function (req, res) {
    var userID = req.body.user_id;
    if(userID) {
         UserInfo.findById(userId, function (err, searchedUser) {
            if(err) {
                res.json({'message': 'user not found'});
            } else {
                res.json({'user': searchedUser});
            }
         });
    } else {
        res.json({'message': 'user ID not provided'});
    }
});


router.post("/getUserCards", function (req, res) {
    var id = mongoose.Types.ObjectId(req.body.user_id);

    Card.find({ "user_info_id": id }, function (err, cards) {
        if (err) return res(err);
        if (cards) {
            res.json({ "cards": cards });
        } else {
            res.send({ 'message': 'no user cards found' });
        }
    });
});




router.post("/loginCustomUser", function (req, res) {
    if(!('email' in req.body) || req.body.email == "" || !('password' in req.body) || req.body.password == "") {
        res.json({"message": "Inavlid email/password"});
        return;
    }

    UserInfo.findOne({ 'email': req.body.email }, function (err, searchedUser) {
        if (err) {
            res.json({ 'message': 'Error connecting to database' });
        } else {
            if (searchedUser) {
                password(req.body.password).verifyAgainst(searchedUser.password, function(error, verified) {
                    if(error)
                        res.json({ 'message': 'Something went wrong' });
                    if(!verified) {
                        res.json({ 'message': 'Wrong password' });
                    } else {
                        searchedUser.number_visit++;
                        searchedUser.save();
                        var userObj = searchedUser.toObject();
                        delete userObj.password;
                        res.json({"user": userObj, "user_id": userObj._id });
                    }
                });
            } else {
                res.json({ 'message': 'Username does not exist' });
            }
        }
    });

});



router.post("/registerCustomUser", function (req, res) {
    if(!('email' in req.body) || req.body.email == "" || !('password' in req.body) || req.body.password == "") {
        res.json({"message": "Inavlid email/password"});
    }

    var newUserInfo = UserInfo({
        email: req.body.email,
        name: req.body.name,
    });

    UserInfo.findOne({ 'email': req.body.email }, function (err, searchedUser) {
        if (err) {
            res.json({ 'message': 'Error connecting to database' });
        } else {
            if (searchedUser) {
                res.json({ 'message': 'Username already exists' });
            } else {
                //New User
                password(req.body.password).hash(function(error, hash) {
                    if (error) {

                    } else {
                        newUserInfo.password = hash;
                        newUserInfo.save(function(err, savedUser) {
                            if (err) {
                                res.json({ 'message': 'Error saving user to database' });
                            } else {
                                var userObj = savedUser.toObject();
                                delete userObj.password;
                                res.json({"user": userObj, "user_id": userObj._id });
                            }
                        });
                    }
                });
            }
        }
    });

});





// assuming POST: name=foo&color=red            <-- URL encoding
// or       POST: {"name":"foo","color":"red"}  <-- JSON encoding
router.post("/registerUser", function (req, res) {
    if(!('email' in req.body) || req.body.email == "") {
        res.json({"message": "Inavlid email"});
        return;
    }


    var newUserInfo = UserInfo({
        name: req.body.name,
        email: req.body.email,
        date_of_birth: req.body.age,
        home: req.body.home,
        living_in: req.body.living_in,
        citizenship: req.body.citizenship,
        profile_pic: req.body.profile_pic,
        facebook_id: req.body.facebook_id
    });


    //Special user to test first time use case
    if (req.body.email == 'travscapade@gmail.com') {
        UserInfo.findOne({ 'email': req.body.email }, function (err, searchedUser) {
            if (err) {

            } else {
                if (searchedUser) {
                    searchedUser.interests=[];
                    searchedUser.location_lat=null;
		    searchedUser.location_lng=null;
		    delete searchedUser.location_lat;
                    delete searchedUser.location_lng;
                    searchedUser.number_visit=0;
                    searchedUser.seen_list=[];
                    searchedUser.save();
                    res.json({"user": searchedUser, "user_id": searchedUser._id });
                    return;
                } else {
                    newUserInfo.save(function (err, savedUser) {
                        if (err) {
                            res.json({ 'message': 'Error creating user, possibly duplicate' });
                            return;
                        } else {
                            res.json({"user":savedUser, "user_id": newUserInfo._id });
                            return;
                        }
                    });
                }
            }
        });
        return;
    }





    UserInfo.findOne({ 'email': req.body.email }, function (err, searchedUser) {
        if (err) {
            res.json({ 'message': 'Error connecting to database' });
        } else {
            if (searchedUser) {
                //res.json({'user': searchedUser});
                if (('type' in req.body) && req.body.type == "custom") {
                    if ((!('password' in req.body) || req.body.password != "travscapade")) {
                        res.json({"message": "Inavlid password"});
                    }
                }

                if('profile_pic' in req.body && req.body.profile_pic && searchedUser.profile_pic != req.body.profile_pic) {
                    updateCardsUserInfo(searchedUser._id);
                    searchedUser.profile_pic = req.body.profile_pic;
                    searchedUser.save();
                }
                searchedUser.number_visit++;
                //console.log(searchedUser);
                searchedUser.save();
                res.json({"user": searchedUser, "user_id": searchedUser._id });
            } else {
                if (('type' in req.body) && req.body.type == "custom") {
                    res.json({"message": "No User Found"});
                } else {
                    newUserInfo.save(function (err, savedUser) {
                        if (err) {
                            res.json({ 'message': 'Error creating user, possibly duplicate' });
                        } else {
                            res.json({"user":savedUser, "user_id": newUserInfo._id });
                        }
                    });
                }
            }
        }
    });
});


function updateCardsUserInfo(userID) {
    Card.find({ "user_info_id": userID }).populate('user_info_id').exec(function (err, cards) {
        if (err) {
            console.log("Could not update cards");
        } else {
            cards.forEach(function(card) {
                card.user_name = card.user_info_id.name;
                card.user_profile_pic = card.user_info_id.profile_pic;
                card.save();
            });
        }

    });
}


router.post("/subscribe", function (req, res) {
    var email = req.body.email;
    fs.appendFile('subscribers.txt', email + ' ', function (err) {

        if (!err){
            res.json({ 'message': email });
        }
        else {
            console.log(err);
            res.json({ 'message': 'Error adding subscriber' });
        }
    });
});

router.post("/registerInterests", function (req, res) {
    var userId = req.body.user_id;
    var interestList = req.body.interests;

    UserInfo.findById(userId, function (err, searchedUser) {
        if (!searchedUser)
            res.json('user_id not found');
        else {
            searchedUser.updated_at = new Date();
            searchedUser.interests = interestList;
            searchedUser.save(function (err) {
                if (err)
                    res.json({ "message": "Error updating user interest" });
                else
                    res.json({ "interests": interestList });
            });
        }
    });
});


router.post("/registerNationality", function (req, res) {
    var userId = req.body.user_id;
    var nationality = req.body.nationality;

    UserInfo.findById(userId, function (err, searchedUser) {
        if (!searchedUser)
            res.json('user_id not found');
        else {
            searchedUser.updated_at = new Date();
            searchedUser.nationality = nationality;
            searchedUser.save(function (err) {
                if (err)
                    res.json({ "message": "Error updating user interest" });
                else
                    res.json({ "nationality": nationality });
            });
        }
    });
});



/*function getImageSize(imgUrl, callback) {
    var request = http.get(imgUrl, function (response) {
        imagesize(response, function (err, result) {
            console.log(result);
            request.abort();
            callback(result.width, result.height);
        });
    });
}*/


router.post("/registerCard", function (req, res) {
    var newCard = Card({
        card_type: req.body.card_type,
        location: req.body.location,
        location_id: req.body.location_id,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        user_info_id: req.body.user_id,
        url: req.body.url,
        thumbnail: req.body.thumbnail,
        title: req.body.title,
        description: req.body.description,
        interests: req.body.interests
    });

    var imgUrl;
    if(req.body.card_type == "photo") {
        imgUrl = req.body.url;
    } else {
        imgUrl = req.body.thumbnail;
    }


    UserInfo.findById(req.body.user_id, function (err, searchedUser) {
        if (!searchedUser) {
            res.json({ 'message': 'user_id not found' });
            return 0;
        } else {
            newCard.user_profile_pic = searchedUser.profile_pic;
            newCard.user_home = searchedUser.home;
            newCard.user_name = searchedUser.name;

            //getImageSize(imgUrl, function(width, height) {
            requestImageSize(imgUrl, function(err, size, downloaded) {
                newCard.picture_width = size.width;
                newCard.picture_height = size.height;

                newCard.save(function (err, savedCard) {
                    if (err) {
                        res.json({ "message": err });
                    } else {
                        gatherLocationInfo(savedCard._id, savedCard.title, savedCard.location.split(',')[0], function(location, extract){
                            console.log(location + " : " + extract);
                        });
                        getLocationScore.getLocationScore(savedCard);
                        if (req.body.card_type == "photo") {
                            searchedUser.photo_count = searchedUser.photo_count + 1;
                            searchedUser.save();
                        }
                        res.json({"saved_card": newCard});
                    }
                });
            });
        }
    });

});




router.post("/updateLocation", function (req, res) {
    var userId = req.body.user_id;
    var lat = req.body.lat;
    var lng = req.body.lng;

    console.log(userId);


    UserInfo.findById(userId, function (err, searchedUser) {
        if (!searchedUser)
            res.json('user_id not found');
        else {
            searchedUser.updated_at = new Date();
            searchedUser.location_lat = lat;
            searchedUser.location_lng = lng;
            searchedUser.save(function (err) {
                if (err)
                    res.json({ "message": "Error updating user interest" });
                else
                    res.json({ "user_id": userId });
            });
        }
    });
});



router.get("/getImage", function(req, res) {
    if('url' in req.query) {
        var imageURL = req.query.url;
        //console.log(imageURL);

        var requestSettings = {
            url: imageURL,
            method: 'GET',
            encoding: null
        };

        request(requestSettings, function(error, response, body) {
            res.set('Content-Type', 'image');
            res.send(body);
        });

    } else {
        res.json({ "message": "No url" });
    }
});


var file = __dirname + '/aws.json';
var cred = JSON.parse(fs.readFileSync(file, 'utf8'));
AWS.config.update({ accessKeyId: cred.key, secretAccessKey: cred.secret });
var s3 = new AWS.S3();

var upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'travnet',
    metadata: function (req, file, cb) {
      cb(null, {fieldName: file.fieldname});
    },
    key: function (req, file, cb) {
      cb(null, file.originalname);
    }
  })
})

router.post('/uploadImage', upload.single('image_file'), function(req, res) {
  res.json("Success");
})


router.post("/adminGetLocations", function (req, res) {
    var userId = req.body.user_id;

    UserInfo.findById(userId, function (err, searchedUser) {
        if (!searchedUser) {
            res.json('user_id not found');
        } else {
            if(searchedUser.user_type == "admin") {
                LocationInfo.find({}).exec(function(err, locationCards) {
                    res.json({'locations': locationCards});
                });
            } else {
                res.json('User not admin');
            }
        }
    });
});



router.post("/adminUpdateLocation", function (req, res) {
    var locationObj = req.body.location_obj;

    LocationInfo.findById(locationObj._id, function(err, searchedLocation) {
        if (err) {
            res.json("Location Object Not Found");
        } else {
            searchedLocation.summary = locationObj.summary;
            searchedLocation.link = locationObj.link;
            searchedLocation.save();
            res.json({'location_obj':searchedLocation});
        }
    });

});



module.exports = router;
