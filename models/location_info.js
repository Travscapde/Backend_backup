var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var locationInfoSchema = new Schema({
    name: { type: String, required: true, unique: true },
    summary : String,
    link : String
});


// on every save, add the date
locationInfoSchema.pre('save', function (next) {
    var currentDate = new Date();
    this.updated_at = currentDate;
    if (!this.created_at)
        this.created_at = currentDate;

    next();
});


var LocationInfoSchema = mongoose.model('LocationInfoSchema', locationInfoSchema);
module.exports = LocationInfoSchema;


