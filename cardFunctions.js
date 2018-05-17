var Card = require('./models/card');
var UserInfo = require('./models/user_info');
var LocationInfo = require('./models/location_info');
var VisaInfo = require('./models/visa_info');
var WeatherInfo = require('./models/weather_info');








exports.searchByLocation = function(cards, locationString) {
    matchedCards = cards.filter(function(value){return (value.location.indexOf(locationString) > -1) });
    return matchedCards;

}






function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}



exports.ranker = function(cards, user, latitude, longitude) {


    //Separate Picture and blog cards
    var pictureCards = cards.filter(function(x) {
        return (x.card_type == "photo")
    });
    var blogCards = cards.filter(function(x) {
        return (x.card_type == "blog")
    });
    //console.log(cards.length + " cards split into " + pictureCards.length + " picture cards and " + blogCards.length + " blog cards");

    //Randomize
    //console.log(pictureCards.splice(0,3));
    pictureCards = shuffle(pictureCards);
    blogCards = shuffle(blogCards);
    //console.log(pictureCards.length + " " + blogCards.length);
    //console.log(pictureCards.splice(0,3));
    

    //Rank according to scores
    pictureCards.sort(function (card1, card2) {
        if(cardScore(card1, user, latitude, longitude) > cardScore(card2, user, latitude, longitude)) {
            return -1;
        } else {
            return 1;
        }
    });

    blogCards.sort(function (card1, card2) {
        if(cardScore(card1, user, latitude, longitude) > cardScore(card2, user, latitude, longitude)) {
            return -1;
        } else {
            return 1;
        }
    });
    //console.log(pictureCards.length + " " + blogCards.length);


    //Separate Seen cards
    var i;
    var seenPictureCards = [];
    for (i=0;i<pictureCards.length;i++){
        var idx = user.seen_list.indexOf(pictureCards[i]._id);
        if( idx > -1) {
            var seenCard = (pictureCards.splice(i, 1))[0];
            seenPictureCards.push(seenCard);    
            i--;
        }
    }
    var seenBlogCards = [];
    for (i=0;i<blogCards.length;i++){
        var idx = user.seen_list.indexOf(blogCards[i]._id);
        if( idx > -1) {
            var seenCard = (blogCards.splice(i, 1))[0];
            seenBlogCards.push(seenCard);    
            i--;
        }
    }

    var sortedPictureCards = pictureCards.concat(seenPictureCards);
    var sortedBlogCards = blogCards.concat(seenBlogCards);
    
    //console.log(sortedPictureCards.length + " " + sortedBlogCards.length);

    
    //Merge picture and blog cards 
    //Assume number of picture cards greater than blog cards 
    var ratio = Math.round(sortedPictureCards.length/sortedBlogCards.length);
    //console.log("ratio " + ratio);
    var sortedCards = [];
    var blogIdx = 0;
    for (i=0; i<sortedPictureCards.length; i+=ratio) {
        //console.log(sortedPictureCards.length + " " + sortedCards.length);
        sortedCards.push.apply(sortedCards, sortedPictureCards.slice(i, i+ratio));
        if (blogIdx < sortedBlogCards.length) {
            sortedCards.push.apply(sortedCards, sortedBlogCards.slice(blogIdx, blogIdx+1));   
            blogIdx++; 
        }
    }
    sortedCards.push.apply(sortedCards, sortedBlogCards.slice(blogIdx));   

    var j;
    //console.log("Scores");
    for (j=0;j<sortedCards.length;j++) {
        //console.log(cardScore(sortedCards[j], user, latitude, longitude));
    }

    //console.log(sortedCards.length);
    return sortedCards;

}

function cardScore(card, user, latitude, longitude) {
    var score = 0;


    //Like to Seen Ratio
    var likes_score;
    if (card.seen_count && card.seen_count != 0) {
        likes_score = card.likes/card.seen_count;
    } else {
        likes_score = 0.3;
    }

    if(likes_score > 1)
        likes_score = 1;


    //Interest match
    var interest_score = 0;
    var i;
    for (i=0;i<card.interests.length;i++) {
        if(user.interests.indexOf(card.interests[i]) != -1) {
            interest_score++;
        }
    }

    //Location
    var proximity_score = 0;
    if (user.location_lat != 500 && user.location_lng != 500) {
        var distance = getDistanceFromLatLonInKm(user.location_lat, user.location_lng, card.latitude, card.longitude);
        if (distance < 1000) {
            proximity_score = 1;
        } else if (distance < 3700) {
            proximity_score = 0.6;
        } else if (distance < 9300) {
            proximity_score = 0.3;
        } else {
            proximity_score = 0;
        }
    }

    score = (1*likes_score) + (1*interest_score) + (1*proximity_score); 

    //console.log(score + " " + likes_score + " " + interest_score + " " + proximity_score);
    return score;
    //return card.created_at;
}



function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  // deg2rad below
    var dLon = deg2rad(lon2-lon1); 
    var a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI/180)
}


function addScore (cards) {
    return new Promise(function(resolve, reject) {
        WeatherInfo.find({}, function(err, weather_info_array) {
            if(err) {
                reject(err)
            } else {
                var i;
                for (i=0;i<cards.length;i++) {
                    if(cards[i].location_score_id) {
                        var weatherInfo = weather_info_array.filter(function(value){return value._id==cards[i].location_score_id.toString();})[0];
                        cards[i].location_score = weatherInfo.score;
                    }
                    
                } 

                resolve();     
            }
        });        
    });
}



function addLocationInfo (cards, user, latitude, longitude) {
    return new Promise (function(resolve, reject) {
        LocationInfo.find({}, function(err, location_info_array){
            if (err) {
                reject(err);
            } else {
                var i;
                for (i=0;i<cards.length;i++) {
                    if(cards[i].location_info_id) {
                        var locationInfo = location_info_array.filter(function(value){return value._id==cards[i].location_info_id.toString();})[0];
                        cards[i].location_info_name = locationInfo.name;
                        cards[i].location_info_summary = locationInfo.summary;
                        cards[i].location_info_link = locationInfo.link;   
                    } else {
                        cards[i].location_info_name = "";
                        cards[i].location_info_summary = "";
                        cards[i].location_info_link = "";      
                    }


                    if (latitude!=500 && longitude!=500) {
                        var dist = parseInt(getDistanceFromLatLonInKm(latitude, longitude, cards[i].latitude, cards[i].longitude));
                        cards[i].distance = dist; 
                    }
                }

                resolve();            
            }
        });    
    });
}



function addVisaInfo (cards, user) {
   
    return new Promise (function(resolve, reject) {
   
        if (!user.nationality) {
            var i;
            for (i=0;i<cards.length;i++) {
                cards[i].visa_info = "Nationality needed";
            }      
            resolve();  
            return;
        }

        VisaInfo.findOne({'origin': user.nationality}, function(err, VisaInfo) {
            if (err) {
                reject(err);
            } else {
                for (i=0;i<cards.length;i++) {
                    var destination = cards[i].location.split(',')[1].trim();

                    if(user.nationality == destination) {
                        cards[i].visa_info = "Visa Not Required";
                    } else if (!VisaInfo) {
                        cards[i].visa_info = "Not available";
                    } else if(VisaInfo.visa_required.indexOf(destination) > -1) {
                        cards[i].visa_info = "Visa Required";
                    } else if(VisaInfo.not_required.indexOf(destination) > -1) {
                        cards[i].visa_info = "Visa Not Required";
                    } else if(VisaInfo.on_arrival.indexOf(destination) > -1) {
                        cards[i].visa_info = "Visa On Arrival";
                    } else if(VisaInfo.e_visa.indexOf(destination) > -1) {
                        cards[i].visa_info = "Electronic Visa Required";
                    } else {
                        cards[i].visa_info = "Unknown"
                    }
                }
                resolve();
                
            }
        });
    });
}



function findInBucketList(element) { 
    return element.name === 'cherries';
}




exports.addInfo = function(cards, user, latitude, longitude, idx, callback) {

    var i;
    for (i=0;i<cards.length;i++) {
        //Checking if user likes the card    
        if (user.like_list.indexOf(cards[i]._id) > -1) {
            cards[i].is_liked = true;
        } else {
            cards[i].is_liked = false;
        }
         
        //Checking if user bucket listed the card
        var bucketListed = 0;
        for (var j=0;j<user.bucket_list.length;j++) {
            if (user.bucket_list[j].cards.indexOf(cards[i]._id) > -1) {
                bucketListed = 1;
                break;
            }
        }

        if (bucketListed == 1) {
            cards[i].is_bucket_listed = true;
        } else {
            cards[i].is_bucket_listed = false;
        }       
    }


    Promise.all([
        addLocationInfo(cards,user,latitude,longitude),
        addScore(cards),
        addVisaInfo(cards,user)
    ])
    .then(function() {
        callback(cards, idx);
    })
    .catch(function(err) {
        console.log(err);
    });
   


    //callback(cards);

    /*Promise.all([
        getAllLocationInfoDB(),
        getVisaInfoDB(user.citizenship)
    ])
    .then(function(location_info_array) {
        var i;
        for (i=0;i<cards.length;i++) {
            //Checking if user likes the card    
            if (user.like_list.indexOf(cards[i]._id) > -1) {
                cards[i].is_liked = true;
            } else {
                cards[i].is_liked = false;
            }
             
            //Checking if user bucket listed the card
            if (user.bucket_list.indexOf(cards[i]._id) > -1) {
                cards[i].is_bucket_listed = true;
            } else {
                cards[i].is_bucket_listed = false;
            }       


            //Adding location info
            if(cards[i].location_info_id) {
                var locationInfo = location_info_array.filter(function(value){return value._id==cards[i].location_info_id.toString();})[0];
                //console.log(locationInfo.name);   
                cards[i].location_info_name = locationInfo.name;
                cards[i].location_info_summary = locationInfo.summary;
                cards[i].location_info_link = locationInfo.link;   
            } else {
                cards[i].location_info_name = "";
                cards[i].location_info_summary = "";
                cards[i].location_info_link = "";      
            }



            if (latitude!=500 && longitude!=500) {
                var dist = parseInt(getDistanceFromLatLonInKm(latitude, longitude, cards[i].latitude, cards[i].longitude));
                
                cards[i].distance = dist; 
                //console.log(latitude + " " + longitude + " " + cards[i].latitude + " " + cards[i].longitude + " " + cards[i].distance);

            }
        }
        callback(cards);

    }).catch(function(err) {
        console.log(err);
        callback(cards);
    });*/


    
    /*LocationInfo.find({}, function(err, location_info_array){
        if (err) {
            console.log(err);
            callback(cards);
            //return cards;
        } else {

            var i;
            for (i=0;i<cards.length;i++) {
                //Checking if user likes the card    
                if (user.like_list.indexOf(cards[i]._id) > -1) {
                    cards[i].is_liked = true;
                } else {
                    cards[i].is_liked = false;
                }
                 
                //Checking if user bucket listed the card
                if (user.bucket_list.indexOf(cards[i]._id) > -1) {
                    cards[i].is_bucket_listed = true;
                } else {
                    cards[i].is_bucket_listed = false;
                }       


                //Adding location info
                if(cards[i].location_info_id) {
                    var locationInfo = location_info_array.filter(function(value){return value._id==cards[i].location_info_id.toString();})[0];
                    //console.log(locationInfo.name);   
                    cards[i].location_info_name = locationInfo.name;
                    cards[i].location_info_summary = locationInfo.summary;
                    cards[i].location_info_link = locationInfo.link;   
                } else {
                    cards[i].location_info_name = "";
                    cards[i].location_info_summary = "";
                    cards[i].location_info_link = "";      
                }



                if (latitude!=500 && longitude!=500) {
                    var dist = parseInt(getDistanceFromLatLonInKm(latitude, longitude, cards[i].latitude, cards[i].longitude));
                    

                    //console.log(roundedDist);
                    
                    cards[i].distance = dist; 
                    //console.log(latitude + " " + longitude + " " + cards[i].latitude + " " + cards[i].longitude + " " + cards[i].distance);
    
                }
            }
            //console.log(cards);          
            callback(cards);
            //return cards;
        }


    });*/

}

