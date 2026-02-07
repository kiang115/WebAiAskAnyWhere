// ==UserScript==
// @name         ai客户端
// @namespace    http://tampermonkey.net/
// @version      2025.12.22
// @description  仅从本地接口获取prompt，删除千问相关逻辑，其他平台仍用DOM操作提交
// @author       smilingpoplar
// @match        https://chat.deepseek.com/*
// @match        https://yuanbao.tencent.com/*
// @match        https://zhida.zhihu.com/*
// @match        https://www.kimi.com/*
// @match        https://chat.qwen.ai/*
// @match        https://www.doubao.com/*
// @match        https://gemini.google.com/*
// @run-at       document-start
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/550940/xxx.js
// @updateURL https://update.greasyfork.org/scripts/550940/xxx.js
// ==/UserScript==

(async () => {
    'use strict';

    // ====================== 1. 工具函数（仅保留本地接口所需） ======================
    const waitForElement = (selector, timeout) => {
        return new Promise((resolve, reject) => {
            const elem = document.querySelector(selector);
            if (elem) return resolve(elem);

            const observer = new MutationObserver(() => {
                const elem = document.querySelector(selector);
                if (elem) {
                    if (timer) clearTimeout(timer);
                    observer.disconnect();
                    resolve(elem);
                }
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });

            let timer;
            if (typeof timeout === 'number' && timeout > 0) {
                timer = setTimeout(() => {
                    observer.disconnect();
                    reject(`在${timeout}ms内，未找到元素：${selector}`);
                }, timeout);
            }
        });
    };

    const delay = (ms) => new Promise(res => setTimeout(res, ms));

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

    // ====================== 2. 核心函数：从本地接口获取query（仅保留此方式） ======================
    /**
     * 从本地接口获取query（带w参数验证）
     * @returns {Promise<string>} 最终的query内容，无则返回空字符串
     */
    const getQueryFromLocalApi = async () => {
        // 1. 验证w参数（已删除千问相关条目）
        const platformWMap = {
            'chat.deepseek.com': 'deepseek',
            'yuanbao.tencent.com': 'yuanbao',
            'zhida.zhihu.com': 'zhihu',
            'www.kimi.com': 'kimi',
            'chat.qwen.ai': 'qwen',
            'www.doubao.com': 'doubao',
            'gemini.google.com': 'gemini'
        };
        const currentHost = window.location.hostname;
        const currentW = platformWMap[currentHost];
        const urlW = new URLSearchParams(window.location.search).get('w');
        if (!urlW || urlW !== currentW) return '';

        // 2. 轮询本地接口获取prompt（原有逻辑保留）
        let query = '';
        for (let i = 0; i < 10; i++) {
            try {
                const res = await fetch('http://127.0.0.1:3000/ai-prompt');
                const data = await res.json();
                if (data.code === 0 && data.prompt) {
                    query = data.prompt;
                    console.log(i);
                    console.log("次轮询成功");
                    console.log(query);
                    break;
                }
            } catch (e) {
                console.debug('轮询本地接口失败：', e);
            }
            await delay(100);
        }
        return query;
    };

    // ====================== 3. 站点配置（已删除千问相关配置） ======================
    const defaultConfig = {
        selector: 'div[contenteditable="true"]',
        simulateInput: simulateInput.textContent,
        simulateEnter: simulateEnter.keyboard()
    };

    const siteConfigs = {
        'chat.deepseek.com': { selector: 'textarea.ds-scroll-area' },
        'yuanbao.tencent.com': {
            beforeInput: async () => { await waitForElement('.input-guide-v2', 3000); }
        },
        'zhida.zhihu.com': {
            simulateInput: simulateInput.insertText,
            simulateEnter: simulateEnter.react
        },
        'www.kimi.com': { simulateInput: simulateInput.textContentWithData },
        'chat.qwen.ai': { selector: 'textarea.message-input-textarea' },
        'www.doubao.com': { selector: 'textarea.semi-input-textarea' }
    };

    // ====================== 4. 主执行流程（无千问特殊处理） ======================
    // 步骤1：从本地接口获取query
    const query = await getQueryFromLocalApi();
    if (!query) return; // 无query直接退出

    // 步骤2：获取当前站点信息
    const currentHost = window.location.hostname;
    const siteConfig = siteConfigs[currentHost] ?? {};
    const config = { ...defaultConfig, ...siteConfig };

    // 步骤3：所有保留的站点执行DOM操作逻辑
    try {
        const editor = await waitForElement(config.selector, 5000);
        await config.beforeInput?.(); // 执行站点前置操作

        editor.focus();
        await delay(100);
        config.simulateInput(editor, query); // 输入内容
        await delay(100);
        config.simulateEnter(editor); // 提交内容
    } catch (error) {
        console.error('执行DOM输入提交失败：', error);
    }
})();