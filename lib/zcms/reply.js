
var pf = require('util').format;
var uis = require('util').inspect;
var log = require('./logger')('reply');
var typeOf = require('zanner-typeof').typeOf;
var meta = require('./usefull').meta;

var reply = module.exports = function(_manager, _id){
  if(!typeOf(_manager, 'object')){
    log.error('In constructor MANAGER is undefined');
    throw pf('Error [reply.constructor]: MANAGER is undefined');
  }
  if(!typeOf(_id, 'string')){
    log.error('In constructor ID is undefined');
    throw pf('Error [reply.constructor]: ID is undefined');
  }
  var self = this, ID = self._id = String(_id).toLowerCase(), MANAGER = self._manager = _manager;
  // manager for reply
  self.manager = function(){
    return MANAGER;
  };
  // id for reply
  self.id = function(){
    return ID;
  };
  // execute -> callback ( request, response )
  // @overwrite
  self.execute = function(request, response, aliasCall){
    log.error('Execute not overloaded of "%s"', ID);
    throw pf('Error [reply.execute]: not overloaded of "%s"', ID);
  };
  // execute match -> match rate return { rate: length in [0, ...), priority: number in (0, 1), match: string }
  // @overwrite
  self.match = function(request, response, aliasCall){
    log.error('Match not overloaded of "%s"', ID);
    throw pf('Error [reply.match]: not overloaded of "%s"', ID);
  };
  // return alias's -> object { alias as string: function, ..}
  // @overwrite
  self.alias = function(){
    log.warning('Alias not overloaded of "%s"', ID);
    return {};
  };
};

reply.prototype.one = function(manager, id, execute, match, alias){
  if(!typeOf(execute, 'function')){
    log.error('Unknown execute for id:"%s" in one', id);
    throw pf('Error [reply.one]: execute for id:"%s" unknown', id);
  }
  if(!typeOf(match, 'function')){
    var matchValue = match;
    match = function(request, response, aliasCall){
      var result = this._oneMatch(id, matchValue, request);
      return result;
    };
  }
  if(!typeOf(alias, 'object')){
    alias = {};
  }
  var r = new reply(manager, id);
  r.execute = function(request, response, aliasCall){
    log.debug('Execute id:"%s"', id);
    var done = execute.apply(r, [request, response, aliasCall]);
    if((done==true) && !response.finished) response.end();
  };
  r.match = function(request, response, aliasCall){
    log.debug('Match id:"%s"', id);
    var result = match.apply(r, [request, response, aliasCall]);
    log.info('Match id:"%s" -> %s', id, uis(result));
    return result;
  };
  r.alias = function(){
    return alias;
  };
  return r;
};

reply.prototype._oneMatchReturn = function(match, priority, pattern, how){
  if(!typeOf(match, 'string')){
    return { rate: 0, priority: 0, match: '' };
  }
  else if(typeOf(priority, 'number') && Number.isFinite(priority)){
    return { rate: match.length, priority: priority, match: match };
  }
  var p = parseFloat(priority);
  if(Number.isFinite(p)){
    return { rate: match.length, priority: p, match: match };
  }
  else if(typeOf(pattern, 'string')){
    switch(how){
      case 'any':
        return { rate: 0, priority: 1, match: match };
      case 'regexp':
      case 'string':
      case 'object':
        return { rate: match.length, priority: match.length/pattern.length, match: match };
      case 'string-like':
        return { rate: 0, priority: match.length/pattern.length, match: match };
    }
  }
  return {rate: 0, priority: 0, match: match };
};

reply.prototype._oneMatch = function(id, match, request){
  switch(typeOf(match)){
    case 'array':
      return this._oneMatchArray(id, match, request);
    case 'object':
      return this._oneMatchObject(id, match, request);
    case 'regexp':
      return this._oneMatchRegexp(id, match, request);
    case 'string':
      return this._oneMatchString(id, match, request);
    default:
      return this._oneMatchReturn('', 0);
      //throw pf('Error [reply._oneMatch]: match for id:"%s" unknown', id);
  }
};

reply.prototype._oneMatchArray = function(id, match, request){
  if((match.length==2) && typeOf(match[0], 'regexp') && typeOf(match[1], 'number')){
    return this._oneMatchObject(id, { path: match[0], priority: match[1] }, request);
  }
  if((match.length==2) && typeOf(match[1], 'regexp') && typeOf(match[0], 'number')){
    return this._oneMatchObject(id, { path: match[1], priority: match[0] }, request);
  }
  var result = this._oneMatchReturn('', 0);
  for(var index in match){
    var tmp = this._oneMatch(id, match[index], request);
    if(!tmp) continue;
    else if(result.rate>tmp.rate) continue;
    else if(result.rate<tmp.rate) result = this._oneMatchReturn(tmp.match, tmp.priority);
    else if(result.priority>tmp.rate) continue;
    else if(result.priority<tmp.rate) result = this._oneMatchReturn(tmp.match, tmp.priority);
    else continue;
  }
  return result;
};

reply.prototype._oneMatchObject = function(id, match, request){
  var rm = typeOf(request.z,'object') && typeOf(request.z.URL,'object') ? request.z.URL : meta(request);
  var pn = typeOf(request.z,'object') && typeOf(request.z.path,'function') ? request.z.path() : meta(request).pathname;
  if(('method' in match) && !this._oneMatchObjectEqual(match.method, rm.method))
    return this._oneMatchReturn('', 0);
  if(('m' in match) && !this._oneMatchObjectEqual(match.m, rm.method))
    return this._oneMatchReturn('', 0);
  if(('host' in match) && !this._oneMatchObjectEqual(match.host, rm.hostname))
    return this._oneMatchReturn('', 0);
  if(('h' in match) && !this._oneMatchObjectEqual(match.h, rm.hostname))
    return this._oneMatchReturn('', 0);
  var value = '';
  if(('path' in match) && !!match.path){
    value = this._oneMatchObjectLLike(match.path, pn); // _oneMatchObjectLLike
    if(value==false) return this._oneMatchReturn('', 0);
    else if(value==true) value = match.path;
  }
  else if(('p' in match) && !!match.p){
    value = this._oneMatchObjectLLike(match.p, pn); // _oneMatchObjectLLike
    if(value==false) return this._oneMatchReturn('', 0);
    else if(value==true) value = match.path;
  }
  var priority;
  if(('priority' in match) && !!match.priority) priority = match.priority;
  else if(('pp' in match) && !!match.pp) priority = match.pp;
  return this._oneMatchReturn(value, priority, pn, 'object');
};

reply.prototype._oneMatchObjectEqual = function(match, value){
  if(match=='*') return true;
  switch(typeOf(match)){
    case 'array':
      if(!match.find(function(m){return (m=='*')||(m==value);})) return false;
    case 'regexp':
      if(!match.test(value)) return false;
      return match.exec(value)[0];
    case 'string':
      if(!(match==value)) return false;
  }
  return true;
};

reply.prototype._oneMatchObjectLLike = function(match, value){
  if(match=='*') return true;
  switch(typeOf(match)){
    case 'array':
      if(!match.find(function(m){return (m=='*')||(value.indexOf(m, 0)==0);})) return false;
    case 'regexp':
      if(!match.test(value)) return false;
      return match.exec(value)[0];
    case 'string':
      if(!(value.indexOf(match, 0)==0)) return false;
  }
  return true;
};

var REPLY_PRIORITY = 2;
reply.prototype._oneMatchRegexp = function(id, match, request){
  var pn = typeOf(request.z,'object') && typeOf(request.z.path,'function') ? request.z.path() : meta(request).pathname;
  var matched = match.exec(pn), priority = 1./REPLY_PRIORITY++;
  if(matched){ // && (matched.index==0)
    return this._oneMatchReturn(matched[0], priority, pn, 'regexp');
  }
  else return this._oneMatchReturn('', 0);
};

reply.prototype._oneMatchString = function(id, match, request){
  var pn = typeOf(request.z,'object') && typeOf(request.z.path,'function') ? request.z.path() : meta(request).pathname;
  // 0.8::get://host1.host2.host3.host4/path1/path2/path3/path4
  var RE = /^(?:([\.\d]+)[\:]{2})?(?:([\w]+|[\*])[\:])?(?:[\/]{2}([\w\.\_\-]+|[\*]))?(?:[\/]([^\/]+(?:[\/][^\/]+)*|[\*])?)?$/i;
  if(pn==match){
    return this._oneMatchReturn(match, 1, pn, 'string');
  }
  else if(0 && pn.indexOf(match, 0)==0){
    return this._oneMatchReturn(match, undefined, pn, 'string-like');
  }
  else if(match=='*'){
    return this._oneMatchReturn('', undefined, pn, 'any');
  }
  else if(RE.test(match)){
    var m = RE.exec(match);
    var matched = {};
    if(m[1]) matched.priority = m[1];
    if(m[2]) matched.method = m[2];
    if(m[3]) matched.host = m[3];
    if(m[4]) matched.path = m[4]=='*' ? '*' : '/' + m[4];
    return this._oneMatchObject(id, matched, request);
  }
  return this._oneMatchReturn('', 0);
};
