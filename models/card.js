// grab the things we need
var mongoose = require('mongoose');
require('mongoose-double')(mongoose);
var Schema = mongoose.Schema;

// create a schema
var cardSchema = new Schema({
    card_type: { type: String, required: true },
    like_list: [Schema.Types.ObjectId],
    likes: { type: Number, default: 0 },
    location: String,
    location_id: String,
    latitude: {type: mongoose.Schema.Types.Double},
    longitude: {type: mongoose.Schema.Types.Double},
    location_info_id: Schema.Types.ObjectId,
    location_score_id: Schema.Types.ObjectId,
    created_at: Date,
    updated_at: Date,

    user_info_id: { type: mongoose.Schema.Types.ObjectId, ref: 'UserInfoSchema', required: true },
    user_profile_pic: String,
    user_name: String,
    user_home: String,
    url: String,
    thumbnail: String,
    picture_width: Number,
    picture_height: Number,
    title: String,
    description: String,
    interests: [String],

    bucket_users: [Schema.Types.ObjectId],
    bucket_count: { type: Number, default: 0 },
    seen_count: {type: Number, default: 0}
});

cardSchema.methods.like = function () {
    this.likes = this.likes + 1;
};

cardSchema.pre('save', function (next) {
    var currentDate = new Date();
    this.updated_at = currentDate;

    if (!this.created_at)
        this.created_at = currentDate;

    next();
});

var Card = mongoose.model('Card', cardSchema);
module.exports = Card;