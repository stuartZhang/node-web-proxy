/**
 * PAC filter rules conforms to <Adblock Plus filters>. The details:
 *    https://www.duoluodeyu.com/1337.html
 */
const _ = require('underscore');
const {jsonLoad} = require('./utils');
const PROXY = '__PROXY__';
const DIRECT = 'DIRECT;';

function createDict(){
  return Object.create(null);
}
function getOwnPropertyDescriptor(obj, key){
  if (obj.hasOwnProperty(key)) {
    return obj[key];
  }
  return null;
}
class Filter{
  static fromText(text){
    if (text in Filter.knownFilters) {
      return Filter.knownFilters[text];
    }
    let ret;
    if (text.at(0) === '!') {
      ret = new CommentFilter(text);
    } else {
      ret = RegExpFilter.fromText(text);
    }
    Filter.knownFilters[ret.text] = ret;
    return ret;
  }
  static get [Symbol.species](){
    return this;
  }
  constructor(text){
    this.text = text;
    this.subscriptions = [];
    this[Symbol.toStringTag] = 'Filter';
  }
  toString(){
    return this.text;
  }
}
_.extendOwn(Filter, {
  'knownFilters': createDict(),
  'elemhideRegExp': /^([^/*|@"!]*?)#(@)?(?:([\w-]+|\*)((?:\([\w-]+(?:[$^*]?=[^()"]*)?\))*)|#([^{}]+))$/,
  'regexpRegExp': /^(@@)?\/.*\/(?:\$~?[\w-]+(?:=[^,\s]+)?(?:,~?[\w-]+(?:=[^,\s]+)?)*)?$/,
  'optionsRegExp': /\$(~?[\w-]+(?:=[^,\s]+)?(?:,~?[\w-]+(?:=[^,\s]+)?)*)$/
});
class InvalidFilter extends Filter{
  static get [Symbol.species](){
    return this;
  }
  constructor(text, reason){
    super(text);
    this.reason = reason;
    this[Symbol.toStringTag] = 'InvalidFilter';
  }
}
class CommentFilter extends Filter{
  static get [Symbol.species](){
    return this;
  }
  constructor(text){
    super(text);
    this[Symbol.toStringTag] = 'CommentFilter';
  }
}
class ActiveFilter extends Filter{
  static get [Symbol.species](){
    return this;
  }
  constructor(text, domains, sitekeys){
    super(text);
    this.domainSource = domains;
    this.sitekeys = sitekeys;
    this.domainSeparator = null;
    this.ignoreTrailingDot = true;
    this.domainSourceIsUpperCase = false;
    this[Symbol.toStringTag] = 'ActiveFilter';
  }
  getDomains(){
    const prop = getOwnPropertyDescriptor(this, 'domains');
    if (prop) {
      return prop;
    }
    let domains = null;
    if (this.domainSource) {
      let source = this.domainSource;
      if (!this.domainSourceIsUpperCase) {
        source = source.toUpperCase();
      }
      const list = source.split(this.domainSeparator);
      if (list.length === 1 && list[0].at(0) !== '~') {
        domains = createDict();
        domains[''] = false;
        if (this.ignoreTrailingDot) {
          list[0] = list[0].replace(/\.+$/, '');
        }
        domains[list[0]] = true;
      } else {
        let hasIncludes = false;
        for (let i = 0; i < list.length; i++) {
          let domain = list[i];
          if (this.ignoreTrailingDot) {
            domain = domain.replace(/\.+$/, '');
          }
          if (domain === '') {
            continue;
          }
          let include;
          if (domain.at(0) === '~') {
            include = false;
            domain = domain.substr(1);
          } else {
            include = true;
            hasIncludes = true;
          }
          if (!domains) {
            domains = createDict();
          }
          domains[domain] = include;
        }
        domains[''] = !hasIncludes;
      }
      this.domainSource = null;
    }
    return this.domains;
  }
  isActiveOnDomain(docDomain, sitekey){
    if (
      this.getSitekeys() &&
      (!sitekey || this.getSitekeys().indexOf(sitekey.toUpperCase()) < 0)
    ) {
      return false;
    }
    if (!this.getDomains()) {
      return true;
    }
    if (!docDomain) {
      return this.getDomains()[''];
    }
    if (this.ignoreTrailingDot) {
      docDomain = docDomain.replace(/\.+$/, '');
    }
    docDomain = docDomain.toUpperCase();
    while (true) { // eslint-disable-line no-constant-condition
      if (docDomain in this.getDomains()) {
        return this.domains[docDomain];
      }
      const nextDot = docDomain.indexOf('.');
      if (nextDot < 0) {
        break;
      }
      docDomain = docDomain.substr(nextDot + 1);
    }
    return this.domains[''];
  }
  isActiveOnlyOnDomain(docDomain){
    if (!docDomain || !this.getDomains() || this.getDomains()['']) {
      return false;
    }
    if (this.ignoreTrailingDot) {
      docDomain = docDomain.replace(/\.+$/, '');
    }
    docDomain = docDomain.toUpperCase();
    for (const domain in this.getDomains()) {
      if (
        this.domains[domain] &&
        domain !== docDomain &&
        (domain.length <= docDomain.length ||
          domain.indexOf(`.${docDomain}`) !==
            domain.length - docDomain.length - 1)
      ) {
        return false;
      }
    }
    return true;
  }
}
class RegExpFilter extends ActiveFilter{
  static fromText(text){ // eslint-disable-line complexity
    let blocking = true;
    const origText = text;
    if (text.indexOf('@@') === 0) {
      blocking = false;
      text = text.substr(2);
    }
    let contentType = null;
    let matchCase = null;
    let domains = null;
    let sitekeys = null;
    let thirdParty = null;
    let collapse = null;
    let options;
    const match = text.indexOf('$') >= 0 ? Filter.optionsRegExp.exec(text) : null;
    if (match) {
      options = match[1].toUpperCase().split(',');
      text = match.input.substr(0, match.index);
      for (let _loopIndex6 = 0; _loopIndex6 < options.length; ++_loopIndex6) {
        let option = options[_loopIndex6];
        let value = null;
        const separatorIndex = option.indexOf('=');
        if (separatorIndex >= 0) {
          value = option.substr(separatorIndex + 1);
          option = option.substr(0, separatorIndex);
        }
        option = option.replace(/-/, '_');
        if (option in RegExpFilter.typeMap) {
          if (contentType == null) {
            contentType = 0;
          }
          contentType |= RegExpFilter.typeMap[option];
        } else if (
          option.at(0) === '~' &&
          option.substr(1) in RegExpFilter.typeMap
        ) {
          if (contentType == null) {
            contentType = RegExpFilter.contentType;
          }
          contentType &= ~RegExpFilter.typeMap[option.substr(1)];
        } else if (option === 'MATCH_CASE') {
          matchCase = true;
        } else if (option === '~MATCH_CASE') {
          matchCase = false;
        } else if (option === 'DOMAIN' && typeof value != 'undefined') {
          domains = value;
        } else if (option === 'THIRD_PARTY') {
          thirdParty = true;
        } else if (option === '~THIRD_PARTY') {
          thirdParty = false;
        } else if (option === 'COLLAPSE') {
          collapse = true;
        } else if (option === '~COLLAPSE') {
          collapse = false;
        } else if (option === 'SITEKEY' && typeof value != 'undefined') {
          sitekeys = value;
        } else {
          return new InvalidFilter(
            origText,
            `Unknown option ${option.toLowerCase()}`
          );
        }
      }
    }
    if (
      !blocking &&
      (contentType == null || contentType & RegExpFilter.typeMap.DOCUMENT) &&
      (!options || options.indexOf('DOCUMENT') < 0) &&
      !/^\|?[\w-]+:/.test(text)
    ) {
      if (contentType == null) {
        contentType = RegExpFilter.contentType;
      }
      contentType &= ~RegExpFilter.typeMap.DOCUMENT;
    }
    try {
      if (blocking) {
        return new BlockingFilter(
          origText,
          text,
          contentType,
          matchCase,
          domains,
          thirdParty,
          sitekeys,
          collapse
        );
      }
      return new WhitelistFilter(
        origText,
        text,
        contentType,
        matchCase,
        domains,
        thirdParty,
        sitekeys
      );

    } catch (e) {
      return new InvalidFilter(origText, e);
    }
  }
  static get [Symbol.species](){
    return this;
  }
  constructor(text, regexpSource, contentType, matchCase, domains, thirdParty, sitekeys){
    super(text, domains, sitekeys);
    this.domainSourceIsUpperCase = true;
    this.length = 1;
    this.domainSeparator = '|';
    this.regexpSource = null;
    this.contentType = RegExpFilter.contentType;
    this.matchCase = false;
    this.thirdParty = null;
    this.sitekeySource = null;
    this.contentType &= ~(RegExpFilter.typeMap.ELEMHIDE | RegExpFilter.typeMap.POPUP);
    this['0'] = '#this';
    this[Symbol.toStringTag] = 'RegExpFilter';
    if (contentType != null) {
      this.contentType = contentType;
    }
    if (matchCase) {
      this.matchCase = matchCase;
    }
    if (thirdParty != null) {
      this.thirdParty = thirdParty;
    }
    if (sitekeys != null) {
      this.sitekeySource = sitekeys;
    }
    if (regexpSource.length >= 2 && regexpSource.at(0) === '/' &&
        regexpSource.at(regexpSource.length - 1) === '/') {
      this.regexp = new RegExp(regexpSource.substr(1, regexpSource.length - 2), this.matchCase ? '' : 'i');
    } else {
      this.regexpSource = regexpSource;
    }
  }
  getRegexp(){
    const prop = getOwnPropertyDescriptor(this, 'regexp');
    if (prop) {
      return prop;
    }
    const source = this.regexpSource
      .replace(/\*+/g, '*')
      .replace(/\^\|$/, '^')
      .replace(/\W/g, '\\$&')
      .replace(/\\\*/g, '.*')
      .replace(
        /\\\^/g,
        '(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)'
      )
      .replace(/^\\\|\\\|/, '^[\\w\\-]+:\\/+(?!\\/)(?:[^\\/]+\\.)?')
      .replace(/^\\\|/, '^')
      .replace(/\\\|$/, '$')
      .replace(/^(\.\*)/, '')
      .replace(/(\.\*)$/, '');
    const regexp = new RegExp(source, this.matchCase ? '' : 'i');
    this.regexp = regexp;
    return regexp;
  }
  getSitekeys(){
    const prop = getOwnPropertyDescriptor(this, 'sitekeys');
    if (prop) {
      return prop;
    }
    let sitekeys = null;
    if (this.sitekeySource) {
      sitekeys = this.sitekeySource.split('|');
      this.sitekeySource = null;
    }
    this.sitekeys = sitekeys;
    return this.sitekeys;
  }
  matches(location, contentType, docDomain, thirdParty, sitekey){
    if (
      this.getRegexp().test(location) &&
      this.isActiveOnDomain(docDomain, sitekey)
    ) {
      return true;
    }
    return false;
  }
}
_.extendOwn(RegExpFilter, {
  'contentType': 2147483647,
  'typeMap': {
    'OTHER': 1,
    'SCRIPT': 2,
    'IMAGE': 4,
    'STYLESHEET': 8,
    'OBJECT': 16,
    'SUBDOCUMENT': 32,
    'DOCUMENT': 64,
    'XBL': 1,
    'PING': 1,
    'XMLHTTPREQUEST': 2048,
    'OBJECT_SUBREQUEST': 4096,
    'DTD': 1,
    'MEDIA': 16384,
    'FONT': 32768,
    'BACKGROUND': 4,
    'POPUP': 268435456,
    'ELEMHIDE': 1073741824
  }
});
class BlockingFilter extends RegExpFilter{
  static get [Symbol.species](){
    return this;
  }
  constructor(text, regexpSource, contentType, matchCase, domains, thirdParty, sitekeys, collapse){
    super(text, regexpSource, contentType, matchCase, domains, thirdParty, sitekeys);
    this.collapse = collapse;
    this[Symbol.toStringTag] = 'BlockingFilter';
  }
}
class WhitelistFilter extends RegExpFilter{
  static get [Symbol.species](){
    return this;
  }
  constructor(text, regexpSource, contentType, matchCase, domains, thirdParty, sitekeys){
    super(text, regexpSource, contentType, matchCase, domains, thirdParty, sitekeys);
    this[Symbol.toStringTag] = 'WhitelistFilter';
  }
}
class Matcher{
  constructor(){
    this.filterByKeyword = this.keywordByFilter = null;
    this.clear();
  }
  clear(){
    this.filterByKeyword = createDict();
    this.keywordByFilter = createDict();
  }
  add(filter){
    if (filter.text in this.keywordByFilter) {
      return;
    }
    const keyword = this.findKeyword(filter);
    const oldEntry = this.filterByKeyword[keyword];
    if (typeof oldEntry == 'undefined') {
      this.filterByKeyword[keyword] = filter;
    } else if (oldEntry.length === 1) {
      this.filterByKeyword[keyword] = [oldEntry, filter];
    } else {
      oldEntry.push(filter);
    }
    this.keywordByFilter[filter.text] = keyword;
  }
  remove(filter){
    if (!(filter.text in this.keywordByFilter)) {
      return;
    }
    const keyword = this.keywordByFilter[filter.text];
    const list = this.filterByKeyword[keyword];
    if (list.length <= 1) {
      Reflect.deleteProperty(this.filterByKeyword, keyword);
    } else {
      const index = list.indexOf(filter);
      if (index >= 0) {
        list.splice(index, 1);
        if (list.length === 1) {
          this.filterByKeyword[keyword] = list[0];
        }
      }
    }
    Reflect.deleteProperty(this.keywordByFilter, filter.text);
  }
  findKeyword(filter){
    let result = '';
    let text = filter.text;
    if (Filter.regexpRegExp.test(text)) {
      return result;
    }
    const match = Filter.optionsRegExp.exec(text);
    if (match) {
      text = match.input.substr(0, match.index);
    }
    if (text.substr(0, 2) === '@@') {
      text = text.substr(2);
    }
    const candidates = text
      .toLowerCase()
      .match(/[^a-z0-9%*][a-z0-9%]{3,}(?=[^a-z0-9%*])/g);
    if (!candidates) {
      return result;
    }
    const hash = this.filterByKeyword;
    let resultCount = 16777215;
    let resultLength = 0;
    for (let i = 0, l = candidates.length; i < l; i++) {
      const candidate = candidates[i].substr(1);
      const count = candidate in hash ? hash[candidate].length : 0;
      if (
        count < resultCount ||
        count === resultCount && candidate.length > resultLength
      ) {
        result = candidate;
        resultCount = count;
        resultLength = candidate.length;
      }
    }
    return result;
  }
  hasFilter(filter){
    return filter.text in this.keywordByFilter;
  }
  getKeywordForFilter(filter){
    if (filter.text in this.keywordByFilter) {
      return this.keywordByFilter[filter.text];
    }
    return null;

  }
  _checkEntryMatch(keyword, location, contentType, docDomain, thirdParty, sitekey){
    const list = this.filterByKeyword[keyword];
    for (let i = 0; i < list.length; i++) {
      let filter = list[i];
      if (filter === '#this') {
        filter = list;
      }
      if (
        filter.matches(location, contentType, docDomain, thirdParty, sitekey)
      ) {
        return filter;
      }
    }
    return null;
  }
  matchesAny(location, contentType, docDomain, thirdParty, sitekey){
    let candidates = location.toLowerCase().match(/[a-z0-9%]{3,}/g);
    if (candidates === null) {
      candidates = [];
    }
    candidates.push('');
    for (let i = 0, l = candidates.length; i < l; i++) {
      const substr = candidates[i];
      if (substr in this.filterByKeyword) {
        const result = this._checkEntryMatch(
          substr,
          location,
          contentType,
          docDomain,
          thirdParty,
          sitekey
        );
        if (result) {
          return result;
        }
      }
    }
    return null;
  }
}
class CombinedMatcher{
  constructor(){
    this.blacklist = new Matcher();
    this.whitelist = new Matcher();
    this.resultCache = createDict();
    this.cacheEntries = 0;
  }
  clear(){
    this.blacklist.clear();
    this.whitelist.clear();
    this.resultCache = createDict();
    this.cacheEntries = 0;
  }
  add(filter){
    if (filter instanceof WhitelistFilter) {
      this.whitelist.add(filter);
    } else {
      this.blacklist.add(filter);
    }
    if (this.cacheEntries > 0) {
      this.resultCache = createDict();
      this.cacheEntries = 0;
    }
  }
  remove(filter){
    if (filter instanceof WhitelistFilter) {
      this.whitelist.remove(filter);
    } else {
      this.blacklist.remove(filter);
    }
    if (this.cacheEntries > 0) {
      this.resultCache = createDict();
      this.cacheEntries = 0;
    }
  }
  findKeyword(filter){
    if (filter instanceof WhitelistFilter) {
      return this.whitelist.findKeyword(filter);
    }
    return this.blacklist.findKeyword(filter);

  }
  hasFilter(filter){
    if (filter instanceof WhitelistFilter) {
      return this.whitelist.hasFilter(filter);
    }
    return this.blacklist.hasFilter(filter);

  }
  getKeywordForFilter(filter){
    if (filter instanceof WhitelistFilter) {
      return this.whitelist.getKeywordForFilter(filter);
    }
    return this.blacklist.getKeywordForFilter(filter);

  }
  isSlowFilter(filter){
    const matcher =
      filter instanceof WhitelistFilter ? this.whitelist : this.blacklist;
    if (matcher.hasFilter(filter)) {
      return !matcher.getKeywordForFilter(filter);
    }
    return !matcher.findKeyword(filter);

  }
  matchesAnyInternal(location, contentType, docDomain, thirdParty, sitekey){
    let candidates = location.toLowerCase().match(/[a-z0-9%]{3,}/g);
    if (candidates === null) {
      candidates = [];
    }
    candidates.push('');
    let blacklistHit = null;
    for (let i = 0, l = candidates.length; i < l; i++) {
      const substr = candidates[i];
      if (substr in this.whitelist.filterByKeyword) {
        const result = this.whitelist._checkEntryMatch(
          substr,
          location,
          contentType,
          docDomain,
          thirdParty,
          sitekey
        );
        if (result) {
          return result;
        }
      }
      if (substr in this.blacklist.filterByKeyword && blacklistHit === null) {
        blacklistHit = this.blacklist._checkEntryMatch(
          substr,
          location,
          contentType,
          docDomain,
          thirdParty,
          sitekey
        );
      }
    }
    return blacklistHit;
  }
  matchesAny(location, docDomain){
    const key = `${location} ${docDomain} `;
    if (key in this.resultCache) {
      return this.resultCache[key];
    }
    const result = this.matchesAnyInternal(location, 0, docDomain, null, null);
    if (this.cacheEntries >= CombinedMatcher.maxCacheEntries) {
      this.resultCache = createDict();
      this.cacheEntries = 0;
    }
    this.resultCache[key] = result;
    this.cacheEntries++;
    return result;
  }
  findProxyForURL(url, host){
    if (this.matchesAny(url, host) instanceof BlockingFilter) {
      return PROXY;
    }
    return DIRECT;
  }
}
_.extendOwn(CombinedMatcher, {
  'maxCacheEntries': 1000
});
async function buildMatcher(filePath){
  const rules = await jsonLoad(filePath);
  const matcher = new CombinedMatcher();
  rules.forEach(rule => matcher.add(Filter.fromText(rule)));
  return matcher;
}
_.extendOwn(exports, {PROXY, DIRECT, buildMatcher});
