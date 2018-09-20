const fs = require('fs');

const dstDir = 'server/assets/';
const srcDir = 'http-client/';
const files = [
    {
        src: `${srcDir}index.html`,
        dst: `${dstDir}index.h`,
        contentVarName: 'ASSET_INDEX_HTML_CONTENT',
        typeVarName: 'ASSET_INDEX_HTML_TYPE',
    },
    {
        src: `${srcDir}scripts.js`,
        dst: `${dstDir}scripts.h`,
        contentVarName: 'ASSET_SCRIPTS_JS_CONTENT',
        typeVarName: 'ASSET_SCRIPTS_JS_TYPE',
    },
    {
        src: `${srcDir}styles.css`,
        dst: `${dstDir}styles.h`,
        contentVarName: 'ASSET_STYLES_CSS_CONTENT',
        typeVarName: 'ASSET_STYLES_CSS_TYPE',
    },
];

const headerTemplate = '// Don\'t modify this file. It\'s been generated.\n';
const varTemplate = 'const char {name}[] PROGMEM = R"=====({content})=====";\n';

function getContentType(fileName) {
    const map = {
        html: 'text/html',
        js: 'application/javascript',
        css: 'text/css',
    };
    for (const item of Object.entries(map)) {
        const regExp = new RegExp(`.${item[0]}`, 'i');
        if (regExp.test(fileName)) {
            return item[1];
        }
    }
}

files.forEach(file => {
    const content = fs.readFileSync(file.src, 'utf8');
    const newFileName = file.dst;
    let newContent = headerTemplate;
    newContent += varTemplate
    .replace('{name}', file.contentVarName)
    .replace('{content}', content
        .replace(/^ +/gm, '')
        .replace(/(\r|\n)/g, '')
    );
    newContent += varTemplate
    .replace('{name}', file.typeVarName)
    .replace('{content}', getContentType(file.src));
    fs.writeFileSync(newFileName, newContent);
});
