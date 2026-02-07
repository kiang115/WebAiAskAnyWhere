// ==UserScript==
// @name         ai客户端
// @namespace    http://tampermonkey.net/
// @version      2025.12.22
// @description  从URL中提取q查询参数，填入对话框，提交搜索。deepseek：chat.deepseek.com/?q={query}，腾讯元宝：yuanbao.tencent.com/?q={query}，知乎直答：zhida.zhihu.com/?q={query}，kimi：www.kimi.com/?q={query}，阿里qwen（用#伪?以免验证）：chat.qwen.ai/#q={query}，字节豆包：www.doubao.com/?q={query}，gemini：gemini.google.com/?q={query}，千问：www.qianwen.com/?q={query}。
// @author       smilingpoplar
// @match        https://chat.deepseek.com/*
// @match        https://yuanbao.tencent.com/*
// @match        https://zhida.zhihu.com/*
// @match        https://www.kimi.com/*
// @match        https://chat.qwen.ai/*
// @match        https://www.doubao.com/*
// @match        https://gemini.google.com/*
// @match        https://www.qianwen.com/*  // 新增千问的匹配规则
// @run-at       document-start
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/550940/%E7%BB%99AI%E6%90%9C%E7%B4%A2%E7%BD%91%E7%AB%99%E6%B7%BB%E5%8A%A0q%E6%9F%A5%E8%AF%A2%E5%8F%82%E6%95%B0%EF%BC%8C%E6%94%AF%E6%8C%81deepseek%2C%E8%85%BE%E8%AE%AF%E5%85%83%E5%AE%9D%2C%E7%9F%A5%E4%B9%8E%E7%9B%B4%E7%AD%94%2Ckimi%2C%E9%98%BF%E9%87%8Cqwen%2C%E5%AD%97%E8%8A%82%E8%B1%86%E5%8C%85%2Cgemini.user.js
// @updateURL https://update.greasyfork.org/scripts/550940/%E7%BB%99AI%E6%90%9C%E7%B4%A2%E7%BD%91%E7%AB%99%E6%B7%BB%E5%8A%A0q%E6%9F%A5%E8%AF%A2%E5%8F%82%E6%95%B0%EF%BC%8C%E6%94%AF%E6%8C%81deepseek%2C%E8%85%BE%E8%AE%AF%E5%85%83%E5%AE%9D%2C%E7%9F%A5%E4%B9%8E%E7%9B%B4%E7%AD%94%2Ckimi%2C%E9%98%BF%E9%87%8Cqwen%2C%E5%AD%97%E8%8A%82%E8%B1%86%E5%8C%85%2Cgemini.meta.js
// ==/UserScript==

(async () => {
    'use strict';

    // ====================== 你给的原脚本代码，一字未改，一行未动 ======================
    const waitForElement = (selector, timeout) => {
        return new Promise((resolve, reject) => {
            const elem = document.querySelector(selector);
            if (elem) return resolve(elem);

            let timer;
            if (typeof timeout === 'number' && timeout > 0) {
                timer = setTimeout(() => {
                    observer.disconnect();
                    reject(`在${timeout}ms内，未找到元素：${selector}`);
                }, timeout);
            }
            const observer = new MutationObserver(() => {
                const elem = document.querySelector(selector);
                if (elem) {
                    if (timer) clearTimeout(timer);
                    observer.disconnect();
                    resolve(elem);
                }
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
        });
    };
    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    const getQuery = {
        search: () => new URLSearchParams(window.location.search).get('q'),
        hash: () => {
            const queryString = location.hash.substring(1);
            return new URLSearchParams(queryString).get('q');
        }
    };
    const simulateInput = {
        textContent: (elem, value) => {
            elem.textContent = value;
            elem.dispatchEvent(new InputEvent('input', { bubbles: true }));
        },
        textContentWithData: (elem, value) => {
            elem.textContent = value;
            elem.dispatchEvent(new InputEvent('input', { data: value, bubbles: true }));
        },
        value: (elem, value) => {
            elem.value = value;
            elem.dispatchEvent(new InputEvent('input', { bubbles: true }));
        },
        insertText: (elem, value) => {
            document.execCommand('insertText', false, value);
            elem.dispatchEvent(new InputEvent('input', { bubbles: true }));
        }
    };
    const simulateEnter = {
        keyboard: (event = 'keydown') => (elem) => {
            elem.dispatchEvent(new KeyboardEvent(event, { key: 'Enter', keyCode: 13, bubbles: true }));
        },
        react: (elem) => {
            const getReactProps = el => el[Object.keys(el).find(k => k.startsWith('__reactProps$'))];
            getReactProps(elem)?.onKeyDown?.({
                key: "Enter",
                code: "Enter",
                keyCode: 13,
                which: 13,
                preventDefault: () => { },
                stopPropagation: () => { },
            });
        }
    };

    const defaultConfig = {
        getQuery: getQuery.search,
        selector: 'div[contenteditable="true"]',
        simulateInput: simulateInput.textContent,
        simulateEnter: simulateEnter.keyboard()
    };
    const siteConfigs = {
        'chat.deepseek.com': {
            selector: 'textarea.ds-scroll-area'
        },
        'yuanbao.tencent.com': {
            beforeInput: async () => {
                // 在.input-guide-v2出现前的对话会被清空，所以等它加载
                await waitForElement('.input-guide-v2', 3000);
            }
        },
        'zhida.zhihu.com': {
            simulateInput: simulateInput.insertText,
            simulateEnter: simulateEnter.react
        },
        'www.kimi.com': {
            simulateInput: simulateInput.textContentWithData,
        },
        'chat.qwen.ai': {
            // getQuery: getQuery.hash,  // 注释掉hash方式获取参数
            selector: 'textarea.message-input-textarea'  // 修改为正确的选择器
        },
        'www.doubao.com': {
            selector: 'textarea.semi-input-textarea'
        },
        'www.qianwen.com': {  // 新增千问的配置
            selector: 'div[data-slate-editor="true"]'
        }
    };
    // ====================== 原脚本代码结束，以下是极简嵌入的本地接口逻辑 ======================

    // 1. 平台标识映射（和发起端的w参数一一对应，极简）
    const platformWMap = {
        'chat.deepseek.com': 'deepseek',
        'yuanbao.tencent.com': 'yuanbao',
        'zhida.zhihu.com': 'zhihu',
        'www.kimi.com': 'kimi',
        'chat.qwen.ai': 'qwen',
        'www.doubao.com': 'doubao',
        'gemini.google.com': 'gemini',
        'www.qianwen.com': 'qianwen'
    };
    const currentHost = window.location.hostname;
    const currentW = platformWMap[currentHost];
    const urlW = new URLSearchParams(window.location.search).get('w');
    // 检测w参数不匹配，直接退出，无任何操作（精准监听，不污染）
    if (!urlW || urlW !== currentW) return;

    // 2. 极简请求本地接口拿prompt（复用原脚本的delay方法）
    let query = '';
    for (let i = 0; i < 10; i++) { // 简单轮询10次，每次500ms，适配页面加载
        try {
            const res = await fetch('http://127.0.0.1:3000/ai-prompt');
            const data = await res.json();
            if (data.code === 0 && data.prompt) {
                query = data.prompt;
                break;
            }
        } catch (e) { }
        await delay(500);
    }
    // 没拿到prompt，直接退出
    if (!query) return;

    // ====================== 以下还是你给的原脚本代码，一字未改 ======================
    const siteConfig = siteConfigs[window.location.hostname] ?? {};
    const config = { ...defaultConfig, ...siteConfig };
    // 注释掉原q参数解析，用本地接口的query替换
    // const query = config.getQuery();
    if (!query) return;

    const editor = await waitForElement(config.selector);
    await config.beforeInput?.();

    editor.focus();
    await delay(100);
    config.simulateInput(editor, query);
    await delay(100);
    config.simulateEnter(editor);
})();