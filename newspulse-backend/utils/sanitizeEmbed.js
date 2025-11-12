const sanitizeHtml = require("sanitize-html");
const ALLOWED = [
  /^https:\/\/(www\.)?youtube\.com\/embed\//i,
  /^https:\/\/(www\.)?youtube-nocookie\.com\/embed\//i,
  /^https:\/\/player\.vimeo\.com\/video\//i,
  /^https:\/\/www\.facebook\.com\/plugins\/video\.php/i,
  /^https:\/\/(www\.)?twitter\.com\/i\/cards\/.*/i,
  /^https:\/\/(www\.)?x\.com\/i\/cards\/.*/i,
  /^https:\/\/.*\.cloudfront\.net\/.*/i,
  /^https:\/\/.*\.akamaized\.net\/.*/i,
];

module.exports = (dirty="") => sanitizeHtml(dirty,{
  allowedTags:["iframe","blockquote","a","div","span","p","img","strong","em"],
  allowedAttributes:{
    iframe:["src","width","height","title","frameborder","allow","allowfullscreen","referrerpolicy"],
    blockquote:["class","data-theme","data-lang"],
    a:["href","target","rel"], img:["src","alt","width","height"], div:["class","data-*"] , span:["class","data-*"] ,
  },
  filterTags:{ iframe:(_t,attrs)=> ALLOWED.some(r=>r.test(attrs?.src||"")) ? attrs : false },
  allowedSchemes:["http","https"], allowProtocolRelative:false,
});
