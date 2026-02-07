// ==UserScript==
// @name         网页上下文AI提问助手
// @version      3.3
// @description  Alt+d触发，支持多选AI模型、多窗口从右到左排列、预测提问词一键填入，自动复制网页url和选中文本发送给AI处理，Context可编辑且无长度限制
// @author       Assistant
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        shortcutKey: 'd',                // 触发快捷键：Alt+d
        aiPlatforms: [                   // AI平台列表（可自行添加/修改）
            { label: 'DeepSeek', value: 'https://chat.deepseek.com' },
            { label: '豆包', value: 'https://www.doubao.com' },
            { label: 'Kimi', value: 'https://www.kimi.com' },
            { label: '通义QWEN', value: 'https://chat.qwen.ai' },
            { label: '通义千问', value: 'https://www.qianwen.com' },
        ],
        // 预测提问词列表（可自定义）
        presetQueries: [
            "解释代码",
            "总结重点",
            "生成步骤",
            "翻译为中文",
        ],
        // 提示词套装列表【核心配置区】
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
        // 窗口排列配置
        windowConfig: {
            width: 450,
            height: 800,
            gap: 20,       // 窗口之间的间距
            baseTop: 100,  // 窗口顶部起始位置
            maxColumns: 3  // 最多横向排列3个窗口，超过则换行
        }
    };

    // 工具函数：仅提取纯文字（用于计数展示，无截断）
    function extractPureText(str) {
        if (!str) return '';
        return str.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
    }

    // 创建操作面板
    function createPanel(initialContext) {
        // 移除已存在的面板
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

        // 面板标题
        const title = document.createElement('h3');
        title.style.cssText = 'margin: 0 0 15px 0; color: #333; font-size: 18px; font-weight: 600;';
        title.textContent = 'AI极简提问助手 v3.3';
        panel.appendChild(title);

        // 1. AI平台多选区域
        const aiMultiSelectWrapper = document.createElement('div');
        aiMultiSelectWrapper.style.cssText = 'margin-bottom: 15px; display: flex; flex-direction: column; gap: 6px;';
        aiMultiSelectWrapper.innerHTML = `
            <label style="font-size: 14px; color: #666;">选择AI平台（可多选）：</label>
            <div id="ai-platforms-container" style="display: flex; flex-wrap: wrap; gap: 8px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px;">
                ${CONFIG.aiPlatforms.map((ai, index) => `
                    <label style="display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 4px; cursor: pointer; background: #f9fafb;">
                        <input type="checkbox" name="ai-platform" value="${ai.value}" style="cursor: pointer;" ${index === 0 ? 'checked' : ''}>
                        <span style="font-size: 14px; color: #333;">${ai.label}</span>
                    </label>
                `).join('')}
            </div>
        `;
        panel.appendChild(aiMultiSelectWrapper);

        // 2. 提示词套装选择
        const promptSetWrapper = document.createElement('div');
        promptSetWrapper.style.cssText = 'margin-bottom: 15px; display: flex; flex-direction: column; gap: 6px;';
        promptSetWrapper.innerHTML = `
            <label style="font-size: 14px; color: #666;">选择提示词套装：</label>
            <select id="prompt-set-select" style="padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 14px; outline: none; width: 100%; box-sizing: border-box;">
                ${CONFIG.promptSets.map((set, index) => `<option value="${index}">${set.name}</option>`).join('')}
            </select>
        `;
        panel.appendChild(promptSetWrapper);

        // 3. Context编辑区域（无截断，仅展示纯文字计数）
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

        // 4. 预测提问词区域（修复空格问题：移除HTML中的换行和空格）
        const presetQueriesWrapper = document.createElement('div');
        presetQueriesWrapper.style.cssText = 'margin-bottom: 15px; display: flex; flex-direction: column; gap: 6px;';
        presetQueriesWrapper.innerHTML = `
            <label style="font-size: 14px; color: #666;">预测提问词（点击自动填入）：</label>
            <div id="preset-queries-container" style="display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px;">
                ${CONFIG.presetQueries.map(query => `<span style="padding: 4px 10px; background: #eef2ff; color: #2563eb; border-radius: 4px; font-size: 13px; cursor: pointer; transition: background 0.2s;">${query}</span>`).join('')}
            </div>
        `;
        panel.appendChild(presetQueriesWrapper);

        // 5. 问题输入框
        const inputWrapper = document.createElement('div');
        inputWrapper.style.cssText = 'margin-bottom: 20px; display: flex; flex-direction: column; gap: 6px;';
        inputWrapper.innerHTML = `
            <label style="font-size: 14px; color: #666;">您的问题：</label>
            <input type="text" id="ai-question-input" placeholder="请输入要提问的内容（可空）..."
                style="padding: 10px; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 14px; outline: none; width: 100%; box-sizing: border-box;">
        `;
        panel.appendChild(inputWrapper);

        // 6. 操作按钮组
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

        // 遮罩层
        const mask = document.createElement('div');
        mask.id = 'ai-assistant-mask';
        mask.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.5); z-index: 999998;
        `;

        // 添加到页面
        document.body.appendChild(mask);
        document.body.appendChild(panel);

        // Context编辑框实时计数（仅展示，无截断）
        const contextTextarea = document.getElementById('current-context');
        const countTextEl = document.getElementById('context-count-text');

        function updateContextCount() {
            const rawText = contextTextarea.value;
            const pureTextLength = extractPureText(rawText).length;
            countTextEl.textContent = `纯文字计数：${pureTextLength}（无长度限制）`;
        }

        // 绑定输入事件
        contextTextarea.addEventListener('input', updateContextCount);

        // 绑定预测提问词点击事件（额外增加trim确保无空格）
        const queryElements = document.querySelectorAll('#preset-queries-container span');
        const questionInput = document.getElementById('ai-question-input');
        queryElements.forEach(el => {
            el.addEventListener('click', () => {
                // 关键修复：使用trim()去除所有首尾空白字符
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

        // 绑定关闭事件
        document.getElementById('ai-cancel-btn').addEventListener('click', closePanel);
        mask.addEventListener('click', closePanel);
        panel.addEventListener('click', e => e.stopPropagation());

        // ESC键关闭面板
        document.addEventListener('keydown', escClosePanel);

        return panel;
    }

    // 关闭面板
    function closePanel() {
        const panel = document.getElementById('ai-assistant-panel');
        const mask = document.getElementById('ai-assistant-mask');
        if (panel) panel.remove();
        if (mask) mask.remove();
        document.activeElement.blur();
        document.removeEventListener('keydown', escClosePanel);
    }

    // ESC键关闭面板
    function escClosePanel(e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
            closePanel();
        }
    }

    // 构建最终Prompt（无截断，直接使用编辑后的完整内容）
    function buildPrompt(userQuery, currentUrl) {
        // 读取编辑后的context完整内容
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

    // 计算下一个窗口的位置（从右到左依次排列）
    // 关键修改：将位置追踪器改为函数内的局部变量，每次调用时初始化
    function calculateNextWindowPosition(tracker) {
        const { width, gap, baseTop, maxColumns, height } = CONFIG.windowConfig;

        // 计算列和行
        if (tracker.columnCount >= maxColumns) {
            tracker.columnCount = 0;
            tracker.rowCount += 1;
        }

        // 计算left和top
        const left = tracker.lastLeft - (tracker.columnCount * (width + gap));
        const top = baseTop + (tracker.rowCount * (height + gap));

        // 更新计数
        tracker.columnCount += 1;

        return { left, top };
    }

    // 打开AI窗口（支持多窗口依次排列）
    function openAIWindow(url, positionTracker) {
        const { width, height } = CONFIG.windowConfig;
        const { left, top } = calculateNextWindowPosition(positionTracker);

        window.open(
            url,
            `AI_Assistant_Window_${Date.now()}`, // 唯一窗口名，避免覆盖
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
    }

    // 核心触发逻辑：Alt+d
    document.addEventListener('keydown', function(e) {
        if (e.altKey && e.key.toLowerCase() === CONFIG.shortcutKey) {
            e.preventDefault();
            e.stopPropagation();

            // 1. 获取原始选中文本（仅作为初始值，无截断）
            const selection = window.getSelection();
            const rawSelectedText = selection.toString().trim().replace(/\s+/g, ' ');
            // 2. 获取当前页面URL
            const currentUrl = window.location.href;

            // 3. 创建面板（传入原始文本作为初始值）
            createPanel(rawSelectedText);
            // 4. 获取面板元素
            const questionInput = document.getElementById('ai-question-input');
            const submitBtn = document.getElementById('ai-submit-btn');

            // 5. 输入框聚焦
            questionInput.focus();

            // 6. 提交按钮事件
            submitBtn.addEventListener('click', () => {
                const userQuery = questionInput.value.trim();
                // 构建Prompt（使用完整的编辑内容）
                const promptText = buildPrompt(userQuery, currentUrl);

                // 获取所有选中的AI平台
                const selectedAIPlatforms = Array.from(document.querySelectorAll('input[name="ai-platform"]:checked')).map(el => el.value);

                // 关键修复：每次提交时重新初始化位置追踪器
                const windowPositionTracker = {
                    lastLeft: window.screen.width - CONFIG.windowConfig.width - 10, // 初始最右侧位置
                    columnCount: 0,
                    rowCount: 0
                };

                // 为每个选中的AI平台打开窗口
                selectedAIPlatforms.forEach(platformUrl => {
                    const finalUrl = `${platformUrl}?q=${promptText}`;
                    openAIWindow(finalUrl, windowPositionTracker); // 传入本次的追踪器
                });

                closePanel();
            });

            // 7. 回车提交问题
            questionInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') submitBtn.click();
            });
        }
    }, true);

    // 控制台加载提示
    console.log('✅ AI极简提问助手 v3.3已加载（修复窗口位置重置问题）');
    console.log('💡 触发：Alt+d | 退出：ESC | 特性：多AI多选、多窗口排列、预测提问词、多提示词套装、Context可编辑且无长度限制');
})();