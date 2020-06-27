// ==UserScript==
// @name        小说下载器
// @namespace   https://blog.bgme.me
// @match       http://www.yruan.com/article/*.html
// @match       https://www.jingcaiyuedu.com/novel/*/list.html
// @match       http://www.shuquge.com/txt/*/index.html
// @match       http://www.dingdiann.com/ddk*/
// @match       https://www.dingdiann.com/ddk*/
// @grant       unsafeWindow
// @require     https://cdn.jsdelivr.net/npm/file-saver@2.0.2/dist/FileSaver.min.js
// @require     https://cdn.jsdelivr.net/npm/jszip@3.2.1/dist/jszip.min.js
// @run-at      document-end
// @version     1.1.1
// @author      bgme
// @description 一个从笔趣阁这样的小说网站下载小说的通用脚本
// @supportURL  https://github.com/yingziwu/Greasemonkey/issues
// @icon        https://greasyfork.org/assets/blacklogo96-1221dbbb8f0d47a728f968c35c2e2e03c64276a585b8dceb7a79a17a3f350e8a.png
// @license     AGPL-3.0-or-later
// ==/UserScript==

"use strict";

/*  本下载器可添加抓取规则以支持更多网站

    抓取规则示例：
    ["www.yruan.com", {
        bookname() { return document.querySelector('#info > h1:nth-child(1)').innerText.trim() },
        author() { return document.querySelector('#info > p:nth-child(2)').innerText.replace(/作\s+者:/, '').trim() },
        intro() { return convertDomNode(document.querySelector('#intro > p'))[0] },
        linkList() { return document.querySelectorAll('div.box_con div#list dl dd a') },
        coverUrl() { return document.querySelector('#fmimg > img').src; },
        chapterName: function(doc) { return doc.querySelector('.bookname > h1:nth-child(1)').innerText.trim() },
        content: function(doc) { return doc.querySelector('#content') },
    }],
    
    抓取规则的 `key` 为该抓取规则适用的网站域名，即 `document.location.host`。

    抓取规则的 `value` 一对象，该对象由7个函数组成：

    函数名          功能                返回值
    bookname()	抓取小说题名            String
    author()	抓取小说作者	        String
    intro()	    抓取小说简介	        String
    linkList()	抓取小说分章链接列表     NodeList
    coverUrl()	抓取小说封面图片地址     String

    以上5个函数在小说目录页（即按下按钮时的页面）运行。

    函数名                  功能                返回值
    chapterName(doc)    抓取小说章节名          String
    content(doc)        抓取小说章节主体部分     Element

    以上2个函数在小说章节页运行，输入值 `doc` 为小说章节页的 `document` 。

    根据上述要求添加好相应网站抓取规则，并在 `// @match` 中添加相应网站，即可在新网站上使用本下载器。

    调试功能：
    将 `enableDebug` 变量改为 `true` 可开启调试功能，开启之后可在控制台（console）中访问如下对象：
    
    对象名	                 类型	  功能
    rule                    变量    当前抓取规则
    main(rule)              函数    运行下载器
    convertDomNode(node)    函数    输出处理后的txt文本及Dom节点
    ruleTest(rule)          函数    测试抓取规则
*/

const enableDebug = false;
const maxRetryTimes = 3;
const maxConcurrency = 10;
const rules = new Map([
    ["www.yruan.com", {
        bookname() { return document.querySelector('#info > h1:nth-child(1)').innerText.trim() },
        author() { return document.querySelector('#info > p:nth-child(2)').innerText.replace(/作\s+者:/, '').trim() },
        intro() { return convertDomNode(document.querySelector('#intro > p'))[0] },
        linkList() { return document.querySelectorAll('div.box_con div#list dl dd a') },
        coverUrl() { return document.querySelector('#fmimg > img').src; },
        chapterName: function(doc) { return doc.querySelector('.bookname > h1:nth-child(1)').innerText.trim() },
        content: function(doc) { return doc.querySelector('#content') },
    }],
    ["www.jingcaiyuedu.com", {
        bookname() { return document.querySelector('div.row.text-center.mb10 > h1:nth-child(1)').innerText.trim() },
        author() { return document.querySelector('div.row.text-center.mb10 a[href^="/novel/"]').innerText.trim() },
        intro: (async function() {
            const indexUrl = document.location.href.replace(/\/list.html$/, '.html');
            return await fetch(indexUrl)
                .then(response => response.text())
                .then(text => {
                    const doc = (new DOMParser()).parseFromString(text, 'text/html');
                    return convertDomNode(doc.querySelector('#bookIntro'))[0]
                })
        }),
        linkList() { return document.querySelectorAll('dd.col-md-4 > a') },
        coverUrl: (async function() {
            const indexUrl = document.location.href.replace(/\/list.html$/, '.html');
            return await fetch(indexUrl)
                .then(response => response.text())
                .then(text => {
                    const doc = (new DOMParser()).parseFromString(text, 'text/html');
                    return doc.querySelector('.panel-body img').getAttribute('data-original')
                })
        }),
        chapterName: function(doc) { return doc.querySelector('h1.readTitle').innerText.trim() },
        content: function(doc) {
            let c = doc.querySelector('#htmlContent');
            let ad = c.querySelector('p:nth-child(1)');
            if (ad.innerText.includes('精彩小说网')) { ad.remove() }
            return c
        },
    }],
    ["www.shuquge.com", {
        bookname() { return document.querySelector('.info > h2').innerText.trim() },
        author() { return document.querySelector('.small > span:nth-child(1)').innerText.replace(/作者：/, '').trim() },
        intro() {
            let iNode = document.querySelector('.intro');
            iNode.innerHTML = iNode.innerHTML.replace(/推荐地址：http:\/\/www.shuquge.com\/txt\/\d+\/index\.html/, '');
            return convertDomNode(iNode)[0];
        },
        linkList() {
            let dl = document.querySelector('.listmain > dl:nth-child(1)');
            let rDt = dl.querySelector('dt:nth-child(1)')
            if (rDt.innerText.includes('最新章节')) {
                let p = null;
                let n = rDt;
                while (true) {
                    if (n.nodeName == 'DD') {
                        p = n;
                        n = n.nextSibling;
                        p.classList.add('not_download')
                    } else if (n.nodeName == 'DT' && !n.innerText.includes('最新章节')) {
                        break;
                    } else {
                        p = n;
                        n = n.nextSibling;
                    }
                }
            }
            return dl.querySelectorAll('dd:not(.not_download) > a')
        },
        coverUrl() { return document.querySelector('.info > .cover > img').src },
        chapterName: function(doc) { return doc.querySelector('.content > h1:nth-child(1)').innerText.trim() },
        content: function(doc) {
            let content = doc.querySelector('#content');
            content.innerHTML = content.innerHTML.replace('请记住本书首发域名：www.shuquge.com。书趣阁_笔趣阁手机版阅读网址：m.shuquge.com', '').replace(/http:\/\/www.shuquge.com\/txt\/\d+\/\d+\.html/, '');
            return content
        },
    }],
    ["www.dingdiann.com", {
        bookname() { return document.querySelector('#info > h1:nth-child(1)').innerText.trim() },
        author() { return document.querySelector('#info > p:nth-child(2)').innerText.replace(/作\s+者：/, '').trim() },
        intro() { return convertDomNode(document.querySelector('#intro'))[0] },
        linkList() {
            let dl = document.querySelector('#list > dl');
            let rDt = dl.querySelector('dt:nth-child(1)')
            if (rDt.innerText.includes('最新章节')) {
                let p = null;
                let n = rDt;
                while (true) {
                    if (n.nodeName == 'DD') {
                        p = n;
                        n = n.nextSibling;
                        p.classList.add('not_download')
                    } else if (n.nodeName == 'DT' && !n.innerText.includes('最新章节')) {
                        break;
                    } else {
                        p = n;
                        n = n.nextSibling;
                    }
                }
            }
            return dl.querySelectorAll('dd:not(.not_download) > a')
        },
        coverUrl() { return document.querySelector('#fmimg > img').src },
        chapterName: function(doc) { return doc.querySelector('.bookname > h1:nth-child(1)').innerText.trim() },
        content: function(doc) {
            let content = doc.querySelector('#content');
            let ad = '<div align="center"><a href="javascript:postError();" style="text-align:center;color:red;">章节错误,点此举报(免注册)</a>,举报后维护人员会在两分钟内校正章节内容,请耐心等待,并刷新页面。</div>';
            content.innerHTML = content.innerHTML.replace(ad, '').replace(/http:\/\/www.shuquge.com\/txt\/\d+\/\d+\.html/, '');
            return content
        },
    }]
]);

const host = document.location.host;
const rule = rules.get(host);
const icon0 = 'data:image/png;base64,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';
const icon1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAMAAAD04JH5AAAAA3NCSVQICAjb4U/gAAAACXBIWXMAAANSAAADUgEQACRKAAAAGXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAAAUdQTFRF////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAiYSOVQAAAGx0Uk5TAAECAwQFCAkKCwwNDhETFRkaHB0fICMkKCwwNTg5PD1AQUZKTk9QV1tcX2BjZGhtb3B2eHl6fX6AgYKHi4+QlJicnaChpamur7C3uru+v8LEyMzP0NXZ3N3f4OTn6uvt7/Hy8/T2+Pn6/P3+VI4wmgAAAyxJREFUeNrtmVdT4zAUhTFs6BB6Cb13WLpooffeQjW9hMT//3mVJbsT4li6ahbD6D4y5p5vzrGuFDkry5QpznLSygAYAANgAAyAATAABsAAGAADYAAMgAEwAD8XADlChTQTIM0eIM0pIM3vAdL8JiLNawFpXo1I8zxAmicS0jwTkeapjDTvC8r0gQQK9UEESvUBBIr1qQTK9SkESvR/wQkQ5V95KhS+Q1AC14N34ZCYenD0LGNjoH7ij2ejQV71QPd2lNQapI8rut0d4LMe0Bz4CHMUSetZCGgPMESRYj1cAGARMIqv1kMlgK8pNQq39TARBB8VhCgyW59S414y6frjxDYeUYTCNnnKHw4WeUxl1/wtGjwk97LToyBan6irmRrPfSHj/K+ZuSJ3TImCav3zaqvlvTN57T9W6+ozJAqa9fH9/gLS3kja/wr69+PUKMhGXUxVie0mVVMXZAUSwONys4ztvHn5kQcgttubJ+tEkde7G2MEiExUyD3VVExE4AAPS40qTlaNSw8QgI+dnlxVx8ncnp0PCsD5WJnaI23Z2Lk3wP1igx83jA2L998V4G8E5WrVy0kRfIeXMLkMm1TIN8GWYXIQTVbKVa+cjLCO4r2+fFnq+X17MZ7N6GmlxRJXt1pWnjh3Q1yX09Vi8tXTl/zb8eeB5GCgkFe9cOAgTutPBcD1stbGEYXVtvYCaA4BwHU9W8smXzt7DesMBMB1NFQMVS8eOgK3hQM4zut6ezZdPbt9/ZWhKQsArpu5OrJ83dwNW0dGAFzHwyVe6iXDx8zt2AEc522jI8etntOx8cbRjAcA1+18/Vf5+vlbvk6cALhORkr/qZeOnHC34QdwnPfNTvzjLtC5+S7QRAQg8eNuYcEW6yAIIF4GQD8A9W5IZX3eFQW6tqI61KNbXf9vy4K/T/2Wd90X+hqFnfHG1K8oUq1nuqpVZD3zjal865nvjBVY74pC/qpg/nYkNQqb6+uZrChYrFcQhcBnOwlR2KIfLoUGlIj1EgaUsPVCUcixnjcKmdZzRCHdeqYo1FgPjUKl9YAolFtPjMIf672i8NP6DFH4br2pH1d/AAm28mJJn9pPAAAAAElFTkSuQmCC';
let nowWorking = 0;
let downloading = false;

window.addEventListener('DOMContentLoaded', function() {
    if (rule.linkList()) { addButton() }
    if (enableDebug) { debug() }
})


function addButton() {
    let button = document.createElement('button');
    button.id = 'novel-downloader';
    button.style.cssText = `position: fixed;
                        top: 15%;
                        right: 5%;
                        z-index: 99;
                        border-style: none;
                        text-align:center;
                        vertical-align:baseline;
                        background-color: rgba(128, 128, 128, 0.2);
                        padding: 5px;
                        border-radius: 12px;`;

    let img = document.createElement('img');
    img.src = icon0;
    img.style.cssText = 'height: 2em;';

    button.onclick = function() {
        if (downloading) {
            alert('正在下载中，请耐心等待……');
        } else {
            downloading = true;
            img.src = icon1;
            console.log('开始下载……')
            main(rule)
        }
    }
    button.appendChild(img);
    document.body.appendChild(button);
}

async function main(rule) {
    let bookname, author, intro, linkList, cover, sourceUrl, infoText;
    [bookname, author, intro, linkList, cover, sourceUrl, infoText] = await getMetadate(rule);

    const pageNum = linkList.length;
    let pageTaskQueue = genPageTaskQueue(linkList);
    let pageWorkerResolved = new Map();
    let pageWorkerRejected = new Map();

    let loopId = setInterval(loop, 800);

    function loop() {
        let finishNum = pageWorkerResolved.size + pageWorkerRejected.size;
        if (finishNum !== pageNum) {
            for (let i = nowWorking; i < maxConcurrency; i++) {
                const pageTask = pageTaskQueue.pop();
                if (pageTask) {
                    nowWorking++;
                    console.log(`开始下载：${pageTask.id}\t${pageTask.dom.innerText}\t${pageTask.url}\t第${pageTask.retry}次重试`);
                    pageWorker(pageTask, pageWorkerResolved, pageWorkerRejected, pageTaskQueue, rule);
                }
            }
        } else {
            clearInterval(loopId);
            save(pageWorkerResolved, bookname, author, infoText, cover, pageNum);
        }
    }
}

function save(pageWorkerResolved, bookname, author, infoText, cover, pageNum) {
    console.log('保存文件中……')
    let sortKeys = [];
    for (let key of pageWorkerResolved.keys()) {
        sortKeys.push(key);
    }
    sortKeys.sort(compareNumeric);

    let savedTxt = infoText;
    let savedZip = new JSZip();
    for (let key of sortKeys) {
        let v = pageWorkerResolved.get(key);
        savedTxt = savedTxt + '\n\n\n\n' + `## ${v.chapterName}` + '\n' + '='.repeat(15) + '\n\n' + v.txt.trim();
        const htmlFileName = 'Chapter' + '0'.repeat(pageNum.toString().length - key.toString().length) + key.toString() + '.html';
        const htmlFile = genHtml(v.chapterName, v.dom);
        savedZip.file(htmlFileName, htmlFile);
    }

    const saveBaseFileName = `[${author}]${bookname}`;
    saveAs((new Blob([savedTxt], { type: "text/plain;charset=utf-8" })), saveBaseFileName + '.txt');
    savedZip.file('info.txt', (new Blob([infoText], { type: "text/plain;charset=utf-8" })));
    savedZip.file(`cover.${cover.type}`, cover.file);
    savedZip.generateAsync({ type: "blob" })
        .then((blob) => { saveAs(blob, saveBaseFileName + '.zip'); })
        .catch(err => console.log('saveZip: ' + err));

    downloading = false;
    document.querySelector('#novel-downloader > img').src = icon0;
    console.log('下载完毕！')

    function compareNumeric(a, b) {
        if (a > b) return 1;
        if (a == b) return 0;
        if (a < b) return -1;
    }
}

function genHtml(chapterName, dom) {
    let htmlFile = (new DOMParser()).parseFromString(
        `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${chapterName}</title></head><body><h2>${chapterName}</h2></body></html>`,
        'text/html');
    htmlFile.querySelector('body').appendChild(dom);
    return new Blob([htmlFile.documentElement.outerHTML], { type: "text/html; charset=UTF-8" })
}

async function getMetadate(rule) {
    let bookname, author, intro, linkList, coverUrl, cover, sourceUrl, infoText;
    if (rule.bookname[Symbol.toStringTag] == 'AsyncFunction') { await rule.bookname().then(result => bookname = result) } else { bookname = rule.bookname() }
    if (rule.author[Symbol.toStringTag] == 'AsyncFunction') { await rule.author().then(result => author = result) } else { author = rule.author() }
    if (rule.intro[Symbol.toStringTag] == 'AsyncFunction') { await rule.intro().then(result => intro = result) } else { intro = rule.intro() }
    if (rule.linkList[Symbol.toStringTag] == 'AsyncFunction') { await rule.linkList().then(result => linkList = result) } else { linkList = rule.linkList() }
    if (rule.coverUrl[Symbol.toStringTag] == 'AsyncFunction') { await rule.coverUrl().then(result => coverUrl = result) } else { coverUrl = rule.coverUrl() }

    await fetch(coverUrl).then(response => {
        cover = {
            'type': response.headers.get('Content-Type').split('/')[1],
            'file': response.blob()
        };
    })
    sourceUrl = document.location.href;
    infoText = `题名：${bookname}\n作者：${author}\n简介：${intro}\n来源：${document.location.href}`;
    return [bookname, author, intro, linkList, cover, sourceUrl, infoText]
}

function genPageTaskQueue(linkList) {
    let pageTaskQueue = [];
    for (let i = 0; i < linkList.length; i++) {
        let pageTask = { 'id': i, 'url': linkList[i].href, 'retry': 0, 'dom': linkList[i] };
        pageTaskQueue.push(pageTask);
    }
    return pageTaskQueue
}

function pageWorker(pageTask, pageWorkerResolved, pageWorkerRejected, pageTaskQueue, rule) {
    let id = pageTask.id;
    let url = pageTask.url;
    let retry = pageTask.retry;
    let dom = pageTask.dom;
    fetch(url).then(
        response => response.text(),
        error => {
            console.error(id, url, error);
            nowWorking--;
            retry++;
            if (retry > maxRetryTimes) {
                pageWorkerRejected.set(id, url);
            } else {
                pageTaskQueue.push({ 'id': id, 'url': url, 'retry': retry, 'dom': dom });
            }
        }
    ).then(text => {
        nowWorking--;
        extractData(id, url, text, rule, pageWorkerResolved)
    })
}

function extractData(id, url, text, rule, pageWorkerResolved) {
    let doc = (new DOMParser()).parseFromString(text, 'text/html');
    const chapterName = rule.chapterName(doc);
    const content = rule.content(doc);
    let txtOut, htmlOut;
    [txtOut, htmlOut] = convertDomNode(content);
    pageWorkerResolved.set(id, {
        'id': id,
        'url': url,
        'chapterName': chapterName,
        'content': content,
        'txt': txtOut,
        'dom': htmlOut
    });
}

function convertDomNode(node) {
    let txtOut = '';
    let htmlOut = document.createElement('div');
    let brc = 0;
    [txtOut, htmlOut, brc] = walker(null, node.childNodes[0], node, brc, txtOut, htmlOut);
    txtOut = txtOut.trim();
    return [txtOut, htmlOut]
}

function walker(p, n, r, brc, txtOut, htmlOut) {
    let pNodeName, nNodeName;
    if (p) { pNodeName = p.nodeName; } else { pNodeName = null; }
    if (n) { nNodeName = n.nodeName; } else { nNodeName = null; }

    const nodeType2 = ['DIV', 'P', 'OL', 'H1', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
    const nodeType3 = ['SCRIPT', 'STYLE', '#comment'];

    let lastNode;
    if (htmlOut.childElementCount !== 0) {
        lastNode = htmlOut.childNodes[htmlOut.childElementCount - 1];
    } else {
        lastNode = document.createElement('p');
    }

    if (nodeType3.includes(nNodeName)) {
        //pass
    } else if (nNodeName === 'BR') {
        brc++
    } else if (nNodeName === '#text') {
        const nodetext = n.textContent.trim()
            .replace(/(\s+)?\n+(\s+)?/g, '').replace(/\s+/, ' ');
        if (nodetext) {
            if (brc === 0) {
                if (nodeType2.includes(pNodeName)) {
                    txtOut = txtOut + '\n'.repeat(2) + nodetext;
                    let p0 = document.createElement('p');
                    p0.innerText = nodetext;
                    htmlOut.appendChild(p0);
                } else {
                    txtOut = txtOut + nodetext;
                    lastNode.innerText = lastNode.innerText + nodetext;
                }
            } else if (brc === 1 || brc === 2) {
                txtOut = txtOut + '\n'.repeat(brc) + nodetext;

                let p0 = document.createElement('p');
                p0.innerText = nodetext;
                htmlOut.appendChild(p0);
            } else {
                txtOut = txtOut + '\n'.repeat(3) + nodetext;

                let p1 = document.createElement('p');
                let p2 = p1.cloneNode();
                let br = document.createElement('br');
                p1.appendChild(br);
                p2.innerText = nodetext;
                htmlOut.appendChild(p1);
                htmlOut.appendChild(p2);
            }
            brc = 0;
        }
    } else if (nodeType2.includes(nNodeName)) {
        if (n.childElementCount === 0) {
            const nodetext = n.innerText.trim();
            if (nodetext) {
                if (brc >= 3) {
                    txtOut = txtOut + '\n'.repeat(3) + nodetext;

                    let p1 = document.createElement('p');
                    let p2 = p1.cloneNode();
                    let br = document.createElement('br');
                    p1.appendChild(br);
                    p2.innerText = nodetext;
                    htmlOut.appendChild(p1);
                    htmlOut.appendChild(p2);
                } else {
                    txtOut = txtOut + '\n'.repeat(2) + nodetext;

                    let p0 = document.createElement('p');
                    p0.innerText = nodetext;
                    htmlOut.appendChild(p0);
                }
            }
        } else {
            [txtOut, htmlOut, brc] = walker(null, n.childNodes[0], n, brc + 2, txtOut, htmlOut);
        }
    } else if (n.childElementCount === 0) {
        const nodetext = n.innerText.trim();
        if (nodetext) {
            txtOut = txtOut + nodetext;
            lastNode.innerText = lastNode.innerText + nodetext;
        }
    } else if (n.childElementCount !== 0) {
        [txtOut, htmlOut, brc] = walker(null, n.childNodes[0], n, brc, txtOut, htmlOut);
    }


    p = n;
    n = n.nextSibling;
    if (n === null) {
        return [txtOut, htmlOut, brc]
    } else {
        [txtOut, htmlOut, brc] = walker(p, n, r, brc, txtOut, htmlOut)
        return [txtOut, htmlOut, brc]
    }
}

function debug() {
    unsafeWindow.rule = rule;
    unsafeWindow.main = main;
    unsafeWindow.convertDomNode = convertDomNode;
    unsafeWindow.ruleTest = ruleTest;
}

async function ruleTest(rule) {
    let bookname, author, intro, linkList, cover, sourceUrl, infoText;
    [bookname, author, intro, linkList, cover, sourceUrl, infoText] = await getMetadate(rule);
    console.log(`infoText:\n${infoText}`);
    console.log('cover: ', cover);
    console.log('linkList: ', linkList);

    let blob = await cover.file;
    let coverImg = document.createElement('img');
    coverImg.src = URL.createObjectURL(blob);
    coverImg.onclick = function() { this.remove() };
    coverImg.style.cssText = `position: fixed; bottom: 8%; right: 8%; z-index: 99; max-width: 150px;`;
    document.body.appendChild(coverImg);

    let pageTask = { 'id': 0, 'url': linkList[0].href, 'retry': 0, 'dom': linkList[0] };
    let pageTaskQueue = [pageTask];
    let pageWorkerResolved = new Map();
    let pageWorkerRejected = new Map();

    let loopId = setInterval(loop, 800);

    function loop() {
        let finishNum = pageWorkerResolved.size + pageWorkerRejected.size;
        if (finishNum != 1) {
            if (pageTaskQueue) {
                pageTaskQueue.pop()
                pageWorker(pageTask, pageWorkerResolved, pageWorkerRejected, pageTaskQueue, rule);
            }
        } else {
            clearInterval(loopId);
            let result = pageWorkerResolved.get(0);
            console.log(result);
        }
    }
}