var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var sessionCardsSchema = new Schema({
    user_id: { type: Schema.Types.ObjectId, unique: true, required: true },
    created_at: Date,
    sorted_cards:  [{ type: Schema.Types.ObjectId, ref: 'Card' }]
});


// on every save, add the date
sessionCardsSchema.pre('save', function (next) {
    var currentDate = new Date();
    this.created_at = currentDate;

    next();
});


var SessionCardsSchema = mongoose.model('SessionCardsSchema', sessionCardsSchema);
module.exports = SessionCardsSchema;
