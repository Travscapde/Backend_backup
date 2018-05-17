var request = require('request');
var WeatherInfo = require('./models/weather_info');
var Card = require('./models/card');


function pad(num, size) {
    var s = "000000000" + num;
    return s.substr(s.length-size);
}




function getLocationScore(card) {
	//console.log("score of" + card.location_id);
	//Check if already exists
	WeatherInfo.findOne({google_place_id:card.location_id}, function(err, searchedlocation) {
		if(searchedlocation) {
			console.log("Location already exists");
			Card.findById(card._id, function (err, card) {
				if(err) {
					console.log(err);
				} else {
					card.location_score_id = searchedlocation._id;
					card.save();
				}
			});
		
		} else {
			getWeatherInfo(card);
		}
	});
}



function getWeatherInfo (card) {

	var latitude = card.latitude;
	var longitude = card.longitude;

	var replies = [{},{},{},{},{},{},{},{},{},{},{},{}];
	var noOfReplies = 0;

	var month;
	for (month=0;month<12;month++) {
		setTimeout(function(monthStr, latitude, longitude) {
			getWeatherMonth (monthStr, latitude, longitude, function(month, reply) {
				replies[month] = reply;
				noOfReplies++;

				if(noOfReplies == 12) {
					saveweatherInfo(card, replies);
				}
			})
		}, 10000*month, pad(month,2), latitude, longitude);
	}

}


function getWeatherMonth(monthStr, latitude, longitude, callback) {
	var authInfo = require("./auth_info.json");
	var key = authInfo.weather_key;

	var getWeatherUrl = 'http://api.wunderground.com/api/' + key + '/planner_' + monthStr + '01' + monthStr + '28/q/' + latitude + ',' + longitude + '.json';
	//console.log(getWeatherUrl);

	request({
			url: getWeatherUrl,
			json: true
		}, function (error, response, body) {
			if (error) {
				console.log(error);
			} else  {
				//console.log(body.trip);
				callback(parseInt(monthStr, 10), body);
			}

		});
}







function saveweatherInfo(card, replies) {
	

	var newWeatherInfoObj = {
		google_place_id: card.location_id,
	    high_temp_max: [],
	    high_temp_avg: [],
	    high_temp_min: [],
		low_temp_max: [],
	    low_temp_avg: [],
	    low_temp_min: [],
		precip_max: [],
		precip_avg: [],
		precip_min: [],

	    score: [],
	};


	var month;
	for (month=0;month<12;month++) {
		newWeatherInfoObj.high_temp_max.push(replies[month].trip.temp_high.max.C);
		newWeatherInfoObj.high_temp_avg.push(replies[month].trip.temp_high.avg.C);
		newWeatherInfoObj.high_temp_min.push(replies[month].trip.temp_high.min.C);

		newWeatherInfoObj.low_temp_max.push(replies[month].trip.temp_low.max.C);
		newWeatherInfoObj.low_temp_avg.push(replies[month].trip.temp_low.avg.C);
		newWeatherInfoObj.low_temp_min.push(replies[month].trip.temp_low.min.C);
		
		newWeatherInfoObj.precip_max.push(replies[month].trip.precip.max.cm);
		newWeatherInfoObj.precip_avg.push(replies[month].trip.precip.avg.cm);
		newWeatherInfoObj.precip_min.push(replies[month].trip.precip.min.cm);
	}


	//Check Validity
	var dataValid = 0;
	var j;
	for (j=0;j<12;j++) {
		if (newWeatherInfoObj.precip_avg[j] != 0.0) {
			dataValid = 1;
			break;
		}
	}

	if (dataValid == 0) {
		console.log("Data Invalid");
		newWeatherInfoObj.score = [-1, -1, -1, -1, -1, -1, -1, -1 ,-1 ,-1, -1, -1];
	} else {

		for (month=0;month<12;month++) {
			var score = calculateWeatherScore(newWeatherInfoObj.high_temp_avg[month], 
																Math.max.apply(null, newWeatherInfoObj.high_temp_avg),
																Math.min.apply(null, newWeatherInfoObj.high_temp_avg),
																newWeatherInfoObj.precip_avg[month]);
			newWeatherInfoObj.score.push(score);	
		}

		newWeatherInfoObj.score = normalizeScore(newWeatherInfoObj.score);
	
	}


	//console.log(newWeatherInfoObj);

	var newWeatherInfo = WeatherInfo(newWeatherInfoObj);

	newWeatherInfo.save(function(err, savedWeatherCard) {
		if(err) {
			console.log(err);
		} else {
			console.log("Weather Info Saved");
			Card.findById(card._id, function (err, card) {
				if(err) {
					console.log(err);
				} else {
					card.location_score_id = savedWeatherCard._id;
					card.save();
				}
			});

		}

	});

}


function calculateWeatherScore(temp, temp_max, temp_min, precip) {

	var tempScore = 0;
	var tempWeight;

	

	if(temp >= 20 && temp <= 33) {
		tempScore=tempScore+2;
	} else if (temp > 15 && temp < 38) {
		tempScore=tempScore+1;
	}

	//Cold region
	if(temp_max<15) {
		var range = temp_max - temp_min;
		if(temp > (temp_min + 0.8*range)) {
			tempScore=tempScore+2;
		} else if (temp > (temp_min + 0.5*range)) {
			tempScore=tempScore+1;
		}
	}

	//Hot region
	if(temp_min>38) {
		var range = temp_max - temp_min;
		if(temp < (temp_max - 0.8*range)) {
			tempScore=tempScore+2;
		} else if (temp < (temp_max - 0.5*range)) {
			tempScore=tempScore+1;
		}
	}

	if ((temp_max - temp_min) < 5) {
		tempWeight = 0;
	} else {
		tempWeight = 1;
	}

	//console.log(temp + " " + temp_max + " " + temp_min + " " + tempScore + " " + tempWeight);


	var precipScore = 0;
	var precipWeight = 1;


	if (precip < 2.2) {
		precipScore=precipScore+2;
	} else if (precip < 4) {
		precipScore = precipScore + 1;
	}

	var score = tempWeight*tempScore + precipWeight*precipScore;

	return score;

}



function normalizeScore(scores) {
	var month, maxScore=0, minScore=1000;
	for (month=0;month<12;month++) {
		if (scores[month] < minScore) {
			minScore = scores[month];
		}
		if(scores[month] > maxScore) {
			maxScore = scores[month];
		}
	}

	var factor;
	if (maxScore-minScore == 0) {
		return [-1, -1, -1, -1, -1, -1, -1, -1 ,-1 ,-1, -1, -1];
	} else {
		factor = 3.0/(maxScore-minScore);
	}
	//console.log(maxScore + " " + factor);

	for (month=0;month<12;month++) {
		scores[month] = (scores[month] - minScore) * factor;
	}

	//console.log(scores);
	return scores;
}


module.exports =  {
	getLocationScore: getLocationScore,
	calculateWeatherScore: calculateWeatherScore,
	normalizeScore: normalizeScore
}