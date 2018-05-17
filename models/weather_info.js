var mongoose = require('mongoose');
var Schema = mongoose.Schema;
require('mongoose-double')(mongoose);

var weatherInfoSchema = new Schema({
    google_place_id: {type: String, required: true, unique: true},
    high_temp_max: [mongoose.Schema.Types.Double],
    high_temp_avg: [mongoose.Schema.Types.Double],
    high_temp_min: [mongoose.Schema.Types.Double],
	low_temp_max: [mongoose.Schema.Types.Double],
    low_temp_avg: [mongoose.Schema.Types.Double],
    low_temp_min: [mongoose.Schema.Types.Double],
	precip_max: [mongoose.Schema.Types.Double],    
	precip_avg: [mongoose.Schema.Types.Double],    
	precip_min: [mongoose.Schema.Types.Double],    

    score: [mongoose.Schema.Types.Double]
});


// on every save, add the date
weatherInfoSchema.pre('save', function (next) {
    var currentDate = new Date();
    this.updated_at = currentDate;
    if (!this.created_at)
        this.created_at = currentDate;

    next();
});


var WeatherInfoSchema = mongoose.model('WeatherInfo', weatherInfoSchema);
module.exports = WeatherInfoSchema;


