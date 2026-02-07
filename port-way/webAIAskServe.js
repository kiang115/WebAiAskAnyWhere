// ==UserScript==
// @name         网页上下文AI提问助手（极简本地接口版）
// @version      3.3
// @description  Alt+d触发，极简本地接口传参，URL仅拼w=平台标识，无任何多余逻辑
// @author       你的原版+极简适配
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        shortcutKey: 'd',                // 触发快捷键：Alt+d
        aiPlatforms: [                   // 你的原版平台列表+新增w平台标识（和接收端对应）
            { label: 'DeepSeek', value: 'https://chat.deepseek.com', w: 'deepseek' },
            { label: '豆包', value: 'https://www.doubao.com', w: 'doubao' },
            { label: 'Kimi', value: 'https://www.kimi.com', w: 'kimi' },
            { label: '通义QWEN', value: 'https://chat.qwen.ai', w: 'qwen' },
            { label: '通义千问', value: 'https://www.qianwen.com', w: 'qianwen' },
            { label: '腾讯元宝', value: 'https://yuanbao.tencent.com', w: 'yuanbao' },
            { label: '知乎直答', value: 'https://zhida.zhihu.com', w: 'zhihu' },
            { label: 'Gemini', value: 'https://gemini.google.com', w: 'gemini' },
        ],
        // 以下全是你的原版配置，一字未改
        presetQueries: [
            "解释代码",
            "总结重点",
            "生成步骤",
            "翻译为中文",
        ],
        promptSets: [
            {
                name: '默认',
                withContext: '先访问[{cur_url}]仔细阅读网页内容，对于[{context}] 回答：[{user_query}]?',
                withoutContext: '先访问[{cur_url}]，仔细阅读网页内容，回答：[{user_query}]?'
            },
            {
                name: '最小代码示例',
                withContext: '先访问[{cur_url}]，对于[{context}],回答(为空跳过)：[{user_query}],并给出最小可用代码示例',
                withoutContext: '先访问[{cur_url}]，回答(为空跳过)：[{user_query}]，并给出最小可用代码示例'
            }
        ],
        windowConfig: {
            width: 450,
            height: 800,
            gap: 20,
            baseTop: 100,
            maxColumns: 3
        },
        localApi: 'http://127.0.0.1:3000/ai-prompt' // 本地接口地址，仅加这一个配置
    };

    // 以下全是你的原版工具函数，一字未改
    function extractPureText(str) {
        if (!str) return '';
        return str.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
    }

    function createPanel(initialContext) {
        const oldPanel = document.getElementById('ai-assistant-panel');
        const oldMask = document.getElementById('ai-assistant-mask');
        if (oldPanel) oldPanel.remove();
        if (oldMask) oldMask.remove();

        const panel = document.createElement('div');
        panel.id = 'ai-assistant-panel';
        panel.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 550px; padding: 20px; background: #fff; border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            box-sizing: border-box;
        `;

        const title = document.createElement('h3');
        title.style.cssText = 'margin: 0 0 15px 0; color: #333; font-size: 18px; font-weight: 600;';
        title.textContent = 'AI极简提问助手 v3.3';
        panel.appendChild(title);

        const aiMultiSelectWrapper = document.createElement('div');
        aiMultiSelectWrapper.style.cssText = 'margin-bottom: 15px; display: flex; flex-direction: column; gap: 6px;';
        aiMultiSelectWrapper.innerHTML = `
            <label style="font-size: 14px; color: #666;">选择AI平台（可多选）：</label>
            <div id="ai-platforms-container" style="display: flex; flex-wrap: wrap; gap: 8px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px;">
                ${CONFIG.aiPlatforms.map((ai, index) => `
                    <label style="display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 4px; cursor: pointer; background: #f9fafb;">
                        <input type="checkbox" name="ai-platform" value="${index}" style="cursor: pointer;" ${index === 0 ? 'checked' : ''}>
                        <span style="font-size: 14px; color: #333;">${ai.label}</span>
                    </label>
                `).join('')}
            </div>
        `;
        panel.appendChild(aiMultiSelectWrapper);

        const promptSetWrapper = document.createElement('div');
        promptSetWrapper.style.cssText = 'margin-bottom: 15px; display: flex; flex-direction: column; gap: 6px;';
        promptSetWrapper.innerHTML = `
            <label style="font-size: 14px; color: #666;">选择提示词套装：</label>
            <select id="prompt-set-select" style="padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 14px; outline: none; width: 100%; box-sizing: border-box;">
                ${CONFIG.promptSets.map((set, index) => `<option value="${index}">${set.name}</option>`).join('')}
            </select>
        `;
        panel.appendChild(promptSetWrapper);

        const contextWrapper = document.createElement('div');
        contextWrapper.style.cssText = 'margin-bottom: 15px; display: flex; flex-direction: column; gap: 6px;';
        const initialPureTextLength = extractPureText(initialContext).length;
        const countText = `纯文字计数：${initialPureTextLength}（无长度限制）`;
        contextWrapper.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="font-size: 14px; color: #666; margin: 0;">当前Context（可编辑，无长度限制）：</label>
                <span id="context-count-text" style="font-size: 12px; color: #999;">${countText}</span>
            </div>
            <textarea id="current-context" style="padding: 10px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px;
                font-size: 14px; color: #333; word-break: break-all; min-height: 80px; line-height: 1.5; box-sizing: border-box; resize: vertical; width: 100%;"
                placeholder="请输入或编辑上下文内容...">${initialContext || ''}</textarea>
        `;
        panel.appendChild(contextWrapper);

        const presetQueriesWrapper = document.createElement('div');
        presetQueriesWrapper.style.cssText = 'margin-bottom: 15px; display: flex; flex-direction: column; gap: 6px;';
        presetQueriesWrapper.innerHTML = `
            <label style="font-size: 14px; color: #666;">预测提问词（点击自动填入）：</label>
            <div id="preset-queries-container" style="display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px;">
                ${CONFIG.presetQueries.map(query => `<span style="padding: 4px 10px; background: #eef2ff; color: #2563eb; border-radius: 4px; font-size: 13px; cursor: pointer; transition: background 0.2s;">${query}</span>`).join('')}
            </div>
        `;
        panel.appendChild(presetQueriesWrapper);

        const inputWrapper = document.createElement('div');
        inputWrapper.style.cssText = 'margin-bottom: 20px; display: flex; flex-direction: column; gap: 6px;';
        inputWrapper.innerHTML = `
            <label style="font-size: 14px; color: #666;">您的问题：</label>
            <input type="text" id="ai-question-input" placeholder="请输入要提问的内容（可空）..."
                style="padding: 10px; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 14px; outline: none; width: 100%; box-sizing: border-box;">
        `;
        panel.appendChild(inputWrapper);

        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';
        btnGroup.innerHTML = `
            <button id="ai-cancel-btn" style="padding: 8px 16px; border: 1px solid #e5e7eb; border-radius: 4px;
                background: #fff; color: #666; font-size: 14px; cursor: pointer; transition: all 0.2s;">
                取消
            </button>
            <button id="ai-submit-btn" style="padding: 8px 16px; border: none; border-radius: 4px;
                background: #2563eb; color: #fff; font-size: 14px; cursor: pointer; transition: all 0.2s;">
                提交提问
            </button>
        `;
        panel.appendChild(btnGroup);

        const mask = document.createElement('div');
        mask.id = 'ai-assistant-mask';
        mask.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.5); z-index: 999998;
        `;

        document.body.appendChild(mask);
        document.body.appendChild(panel);

        const contextTextarea = document.getElementById('current-context');
        const countTextEl = document.getElementById('context-count-text');
        function updateContextCount() {
            const rawText = contextTextarea.value;
            const pureTextLength = extractPureText(rawText).length;
            countTextEl.textContent = `纯文字计数：${pureTextLength}（无长度限制）`;
        }
        contextTextarea.addEventListener('input', updateContextCount);

        const queryElements = document.querySelectorAll('#preset-queries-container span');
        const questionInput = document.getElementById('ai-question-input');
        queryElements.forEach(el => {
            el.addEventListener('click', () => {
                questionInput.value = el.textContent.trim();
                questionInput.focus();
            });
            el.addEventListener('mouseover', () => {
                el.style.background = '#dbeafe';
            });
            el.addEventListener('mouseout', () => {
                el.style.background = '#eef2ff';
            });
        });

        document.getElementById('ai-cancel-btn').addEventListener('click', closePanel);
        mask.addEventListener('click', closePanel);
        panel.addEventListener('click', e => e.stopPropagation());
        document.addEventListener('keydown', escClosePanel);

        return panel;
    }

    function closePanel() {
        const panel = document.getElementById('ai-assistant-panel');
        const mask = document.getElementById('ai-assistant-mask');
        if (panel) panel.remove();
        if (mask) mask.remove();
        document.activeElement.blur();
        document.removeEventListener('keydown', escClosePanel);
    }

    function escClosePanel(e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
            closePanel();
        }
    }

    function buildPrompt(userQuery, currentUrl) {
        const contextTextarea = document.getElementById('current-context');
        const editedContext = contextTextarea.value.trim();
        const promptSetSelect = document.getElementById('prompt-set-select');
        const selectedSet = CONFIG.promptSets[promptSetSelect.value];
        const promptTemplate = editedContext
            ? selectedSet.withContext
            : selectedSet.withoutContext;
        return promptTemplate
            .replace(/{cur_url}/g, currentUrl)
            .replace(/{context}/g, editedContext)
            .replace(/{user_query}/g, userQuery || '');
    }

    function calculateNextWindowPosition(tracker) {
        const { width, gap, baseTop, maxColumns, height } = CONFIG.windowConfig;
        if (tracker.columnCount >= maxColumns) {
            tracker.columnCount = 0;
            tracker.rowCount += 1;
        }
        const left = tracker.lastLeft - (tracker.columnCount * (width + gap));
        const top = baseTop + (tracker.rowCount * (height + gap));
        tracker.columnCount += 1;
        return { left, top };
    }

    // 仅修改：打开窗口时拼w=平台标识，无其他改动
    function openAIWindow(url, w, positionTracker) {
        const { width, height } = CONFIG.windowConfig;
        const { left, top } = calculateNextWindowPosition(positionTracker);
        const finalUrl = `${url}?w=${w}`; // 仅拼w参数，极简！
        window.open(
            finalUrl,
            `AI_Assistant_Window_${Date.now()}`,
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
    }

    // 新增：POST prompt到本地接口，极简封装
    async function postPromptToLocal(prompt) {
        try {
            await fetch(CONFIG.localApi, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `prompt=${encodeURIComponent(prompt)}`
            });
            return true;
        } catch (e) {
            alert('❌ 本地AI接口未启动，请先运行 node local-ai-server.js');
            return false;
        }
    }

    // 核心触发逻辑：仅加POST本地接口的逻辑，其余全是你的原版！
    document.addEventListener('keydown', async function(e) {
        if (e.altKey && e.key.toLowerCase() === CONFIG.shortcutKey) {
            e.preventDefault();
            e.stopPropagation();
            const selection = window.getSelection();
            const rawSelectedText = selection.toString().trim().replace(/\s+/g, ' ');
            const currentUrl = window.location.href;
            createPanel(rawSelectedText);
            const questionInput = document.getElementById('ai-question-input');
            const submitBtn = document.getElementById('ai-submit-btn');
            questionInput.focus();

            submitBtn.addEventListener('click', async () => {
                const userQuery = questionInput.value.trim();
                const promptText = buildPrompt(userQuery, currentUrl);
                // 仅加：先POST到本地接口
                const postOk = await postPromptToLocal(promptText);
                if (!postOk) return;

                const selectedAIIndices = Array.from(document.querySelectorAll('input[name="ai-platform"]:checked')).map(el => el.value);
                const windowPositionTracker = {
                    lastLeft: window.screen.width - CONFIG.windowConfig.width - 10,
                    columnCount: 0,
                    rowCount: 0
                };
                // 遍历打开窗口，拼w参数
                selectedAIIndices.forEach(idx => {
                    const platform = CONFIG.aiPlatforms[idx];
                    openAIWindow(platform.value, platform.w, windowPositionTracker);
                });
                closePanel();
            });

            questionInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') submitBtn.click();
            });
        }
    }, true);

    console.log('✅ AI极简提问助手 v3.3已加载（极简本地接口版）');
    console.log('💡 触发：Alt+d | 退出：ESC | 仅拼w=平台标识，无任何多余逻辑');
})();