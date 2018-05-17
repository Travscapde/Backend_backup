var method = dummy.prototype;

function dummy() {
    //create dummy jsons
}


method.getImage = function() {
    var imgs = ["https://s3-ap-southeast-1.amazonaws.com/travnet/1.jpg"];
    return { "image": imgs };
}

method.getImages = function() {
    var imgs = ["https://s3-ap-southeast-1.amazonaws.com/travnet/1.jpg",
        "https://s3-ap-southeast-1.amazonaws.com/travnet/2.jpg",
        "https://s3-ap-southeast-1.amazonaws.com/travnet/3.jpg",
        "https://s3-ap-southeast-1.amazonaws.com/travnet/4.jpg",
        "https://s3-ap-southeast-1.amazonaws.com/travnet/5.jpg",
        "https://s3-ap-southeast-1.amazonaws.com/travnet/6.jpg",
        "https://s3-ap-southeast-1.amazonaws.com/travnet/7.jpg",
        "https://s3-ap-southeast-1.amazonaws.com/travnet/8.jpg",
        "https://s3-ap-southeast-1.amazonaws.com/travnet/9.jpg",
        "https://s3-ap-southeast-1.amazonaws.com/travnet/10.jpg"]

    return { "image": imgs };
}

method.getCards = function() {
    /*
    id: Schema.Types.ObjectId,
    username: { type: String, required: true, unique: true },
    card_type: { type: String, required: true },
    link: { type: String, required: true },
    likes: { type: Number, default: 0 },
    description: String,
    location: String,
    created_at: Date,
    */

    var json1 = {
        "user-name": "Joy",
        "user-img": "https://s3-ap-southeast-1.amazonaws.com/travnet/user1.jpg",
        "card-type": "image",
        "likes": "213",
        "location": "Bali, Indonesia",
        "content": {
            "url": "https://s3-ap-southeast-1.amazonaws.com/travnet/1.jpg",
            "description": "Chilling",
            "activity": "Sightseeing"
        }
    };

    var json2 = {
        "user-name": "Joy",
        "user-img": "https://s3-ap-southeast-1.amazonaws.com/travnet/user1.jpg",
        "card-type": "image",
        "likes": "35",
        "location": "Maldives",
        "content": {
            "url": "https://s3-ap-southeast-1.amazonaws.com/travnet/2.jpg",
            "description": "Chilling",
            "activity": "Beach"
        }
    };

    var json3 = {
        "user-name": "The Blonde Abroad",
        "user-img": "https://s3-ap-southeast-1.amazonaws.com/travnet/blogger1.jpg",
        "card-type": "blog",
        "likes": "56",
        "location": "General",
        "content": {
            "url": "http://theblondeabroad.com/2014/10/12/20-trips-to-take-in-your-20s/",
            "thumbnail": "https://s3-ap-southeast-1.amazonaws.com/travnet/blog1.jpg",
            "title": "20 trips to take in your 20’s!",
            "abstract": "While there’s no perfect age to get up and go, there is something special about hitting the road and experiencing some of the world’s most incredible adventures in your twenties. Go while you’re young, single and without too much responsibility."
        }
    };

    var json4 = {
        "user-name": "Joy",
        "user-img": "https://s3-ap-southeast-1.amazonaws.com/travnet/user1.jpg",
        "card-type": "image",
        "likes": "64",
        "location": "Arizona, United States",
        "content": {
            "url": "https://s3-ap-southeast-1.amazonaws.com/travnet/4.jpg",
            "description": "Chilling",
            "activity": "Cave"
        }
    };

    var json5 = {
        "user-name": "Adventurous Kate",
        "user-img": "https://s3-ap-southeast-1.amazonaws.com/travnet/blogger2.jpg",
        "card-type": "blog",
        "likes": "234",
        "location": "Bangkok, Thailand",
        "content": {
            "url": "http://www.adventurouskate.com/songkran-in-bangkok-the-greatest-festival-on-earth/",
            "thumbnail": "https://s3-ap-southeast-1.amazonaws.com/travnet/blog2.jpg",
            "title": "Songkran in Bangkok: The Greatest Festival on Earth",
            "abstract": "Songkran in Bangkok is incredible — one of the absolute most fun events on the planet. For three days in April, people celebrate the new year by throwing water on each other, which quickly turns into a giant water fight in the streets."
        }
    };

    var jsonArray = { "cards": [json1, json2, json3, json4, json5] };
    return jsonArray;
}

module.exports = dummy;