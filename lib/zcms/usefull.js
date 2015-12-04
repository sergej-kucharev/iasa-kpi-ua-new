
var pf = require('util').format;
var pu = require('url').parse;
var process = require('process');

var typesOf = module.exports.typesOf = function(items, value){
	if(!typeOf(items, 'array')){
		return typeOf(items, value);
	}
	for(var index in items){
		var item = items[index];
		if(!typeOf(item, value)) return false;
	}
	return true;
};

var meta = module.exports.meta = function(request){
	if(!typeOf(request, 'object')) return {};
	var url = pu(('url' in request) ? request.url : '', true);
	url.method = ('method' in request) ? request.method.toLowerCase() : '-';
	url.http = ('httpVersion' in request) ? request.httpVersion : '-';
	url.headers = ('headers' in request) ? request.headers : {'-':'-'};
	if((url.host==null) && ('host' in url.headers)) url.host = url.headers['host'];
	if(url.hostname==null) url.hostname = url.host.split(':')[0];
	if(url.port==null) url.port = url.host.split(':')[1];
	if('content-type' in url.headers) url.contentType = url.headers['content-type'];
	if('user-agent' in url.headers) url.agent = url.headers['user-agent'];
	if('accept-language' in url.headers) url.language = url.headers['accept-language'];
	if('cookie' in url.headers) url.cookie = url.headers['cookie'];
	if('statusCode' in request) url.statusCode = request.statusCode;
	if('statusMessage' in request) url.statusMessage = request.statusMessage;
	return url;
};

var memUsed = module.exports.memUsed = function(){
	var units = ['', 'kb', 'mb', 'gb'], unit, mem = process.memoryUsage();
	var total = mem.heapTotal;
	for(unit=0; total>1024 && unit<units.length; unit++){
		total /= 1024;
	}
	var result = { size: total.toFixed(3), unit: units[unit], total: mem.heapTotal };
	return result;
}