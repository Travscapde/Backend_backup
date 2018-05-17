var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var visaInfoSchema = new Schema({
    origin: { type: String, required: true, unique: true },
    visa_required: [String],
    not_required: [String],
    on_arrival: [String],
    e_visa: [String],
    unsorted: [String]
});


// on every save, add the date
visaInfoSchema.pre('save', function (next) {
    var currentDate = new Date();
    this.updated_at = currentDate;
    if (!this.created_at)
        this.created_at = currentDate;

    next();
});


var VisaInfoSchema = mongoose.model('VisaInfo', visaInfoSchema);
module.exports = VisaInfoSchema;


