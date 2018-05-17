var express = require("express");
var cors = require('cors')
var app = express();
app.use(cors());
app.options('*', cors());
var router = require('./api');

//start db
var mongoose = require('mongoose');
//mongoose.connect('mongodb://localhost/myappdatabase');
mongoose.Promise = global.Promise;
var authInfo = require("./auth_info.json");
var options = authInfo.dp_options;
mongoose.connect('mongodb://54.169.111.95:27017/mytestdatabase', options);

//support posting
var bodyParser = require('body-parser');
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));
app.use('/api', router);

// Listen to this Port
app.listen(8080, function () {
    console.log("Live at Port 8080");
});