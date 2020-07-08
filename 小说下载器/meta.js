// ==UserScript==
// @name        小说下载器
// @namespace   https://blog.bgme.me
// @match       http://www.yruan.com/article/*.html
// @match       https://www.jingcaiyuedu.com/novel/*/list.html
// @match       http://www.shuquge.com/txt/*/index.html
// @match       http://www.dingdiann.com/ddk*/
// @match       https://www.dingdiann.com/ddk*/
// @match       http://www.biquwo.org/bqw*/
// @match       http://www.xkzw.org/xkzw*/
// @match       https://www.fpzw.com/xiaoshuo/*/*/
// @match       https://www.hetushu.com/book/*/index.html
// @match       http://www.shouda8.com/*/
// @match       https://www.shouda8.com/*/
// @match       https://book.qidian.com/info/*
// @match       https://www.ciweimao.com/chapter-list/*
// @match       http://www.jjwxc.net/onebook.php?novelid=*
// @exclude     http://www.jjwxc.net/onebook.php?novelid=*&chapterid=*
// @match       http://book.sfacg.com/Novel/*/MainIndex/
// @match       http://www.gebiqu.com/biquge_*/
// @match       https://www.meegoq.com/book*.html
// @exclude     https://www.meegoq.com/book/*.html
// @match       http://book.zongheng.com/showchapter/*.html
// @match       http://huayu.zongheng.com/showchapter/*.html
// @match       https://www.17k.com/list/*.html
// @match       http://www.shuhai.com/book/*.htm
// @match       http://mm.shuhai.com/book/*.htm
// @match       http://bianshenbaihe.szalsaf.com/txt/*/index.html
// @match       https://www.biquge.tw/*/
// @match       https://www.uukanshu.com/b/*/
// @grant       unsafeWindow
// @grant       GM_info
// @grant       GM_xmlhttpRequest
// @connect     img.shouda8.com
// @connect     read.qidian.com
// @connect     kuangxiangit.com
// @connect     sinaimg.cn
// @connect     jjwxc.net
// @connect     image.gebiqu.com
// @connect     qidian.qpic.cn
// @connect     static.zongheng.com
// @connect     book.zongheng.com
// @connect     cdn.static.17k.com
// @connect     www.shuhai.com
// @connect     img.uukanshu.com
// @require     https://cdn.jsdelivr.net/npm/file-saver@2.0.2/dist/FileSaver.min.js
// @require     https://cdn.jsdelivr.net/npm/jszip@3.2.1/dist/jszip.min.js
// @require     https://cdn.jsdelivr.net/npm/crypto-js@4.0.0/crypto-js.min.js
// @run-at      document-end
// @version     2.0.6.4
// @author      bgme
// @description 一个可扩展的通用型小说下载器。目前支持起点、晋江、SF轻小说、刺猬猫等小说网站的免费章节，以及亿软小说、精彩小说网、书趣阁、顶点小说、2k小说阅读网、和图书、笔趣窝、星空文学、手打吧等转载网站。详细支持网站列表请打开说明页面。
// @supportURL  https://github.com/yingziwu/Greasemonkey/issues
// @icon        https://greasyfork.org/assets/blacklogo96-1221dbbb8f0d47a728f968c35c2e2e03c64276a585b8dceb7a79a17a3f350e8a.png
// @license     AGPL-3.0-or-later
// ==/UserScript==
