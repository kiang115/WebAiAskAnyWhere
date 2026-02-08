// ==UserScript==
// @name         网页上下文AI提问助手（极简本地接口版）
// @version      3.7
// @description  Alt+d触发，极简本地接口传参，URL仅拼w=平台标识，千问特殊处理；分组式模板+URL复选框控制+自动匹配
// @author       原版+极简适配+千问特殊处理+分组式动态prompt匹配+URL复选框
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        shortcutKey: 'd',                // 触发快捷键：Alt+d
        aiPlatforms: [                   // AI平台列表（和接收端对应）
            { label: 'DeepSeek', value: 'https://chat.deepseek.com', w: 'deepseek' },
            { label: '豆包', value: 'https://www.doubao.com', w: 'doubao' },
            { label: 'Kimi', value: 'https://www.kimi.com', w: 'kimi' },
            { label: '通义QWEN', value: 'https://chat.qwen.ai', w: 'qwen' },
            { label: '通义千问', value: 'https://www.qianwen.com', w: 'qianwen' },
            { label: '腾讯元宝', value: 'https://yuanbao.tencent.com', w: 'yuanbao' },
            { label: '知乎直答', value: 'https://zhida.zhihu.com', w: 'zhihu' },
            { label: 'Gemini', value: 'https://gemini.google.com', w: 'gemini' },
        ],
        presetQueries: [
            "解释代码",
            "总结重点",
            "生成步骤",
            "翻译为中文",
        ],
        // promptSets按名称分组，每组对应多个模板
        promptSets: [
            {
                name: '通用场景组', // 分组名称1（用户可选择）
                templates: [       // 该分组下的模板列表
                    { template: '请分析这个网页的内容：访问[{cur_url}]' }, // 仅cur_url
                    { template: '基于上下文[{context}]，回答我的问题：[{user_query}]' }, // user_query+context
                    { template: '访问[{cur_url}]并阅读[{context}]，回答：[{user_query}]' }, // 全变量
                    { template: '访问[{cur_url}]，回答：[{user_query}]' }, // 全变量
                    { template: '你好，请提供AI帮助' } // 无变量
                    { template: '请回答[{user_query}]' } // 无变量
                ]
            },
            {
                name: '代码场景', // 分组名称2（用户可选择）
                templates: [       // 该分组下的模板列表
                    { template: '你是一个10年编程培训师，你回答时必须直击最底层---你应该先直白的讲解最核心的底层原理，拆解问题---你需要将底层原理拆解为若干流程，并提出每个流程的核心问题，回答问题---详细按照流程回答拆解出的核心问题，保持语言的直白，回顾总结---以终为始，回扣底层原理。禁止使用比喻，表格，大段代码，使用专业名词，确保每个名词都是一看就懂。若某一基础词汇是理解的必要项，需先用人话解释清楚，再继续作答。代码[{context}]，问题[{user_query}]。' }, // 全变量
                    { template: '你是一个10年编程培训师，你回答时必须直击最底层---你应该先直白的讲解最核心的底层原理，拆解问题---你需要将底层原理拆解为若干流程，并提出每个流程的核心问题，回答问题---详细按照流程回答拆解出的核心问题，保持语言的直白，回顾总结---以终为始，回扣底层原理。禁止使用比喻，表格，大段代码，使用专业名词，确保每个名词都是一看就懂。若某一基础词汇是理解的必要项，需先用人话解释清楚，再继续作答。代码[{context}]，问题[{user_query}]。参考网址[{cur_url}]' }, // 仅user_query
                    { template: '你是一个10年编程培训师，你回答时必须直击最底层---你应该先直白的讲解最核心的底层原理，拆解问题---你需要将底层原理拆解为若干流程，并提出每个流程的核心问题，回答问题---详细按照流程回答拆解出的核心问题，保持语言的直白，回顾总结---以终为始，回扣底层原理。禁止使用比喻，表格，大段代码，使用专业名词，确保每个名词都是一看就懂。若某一基础词汇是理解的必要项，需先用人话解释清楚，再继续作答。代码[{context}]。参考网址[{cur_url}]' }, // 仅user_query
                    { template: '你是一个10年编程培训师，你回答时必须直击最底层---你应该先直白的讲解最核心的底层原理，拆解问题---你需要将底层原理拆解为若干流程，并提出每个流程的核心问题，回答问题---详细按照流程回答拆解出的核心问题，保持语言的直白，回顾总结---以终为始，回扣底层原理。禁止使用比喻，表格，大段代码，使用专业名词，确保每个名词都是一看就懂。若某一基础词汇是理解的必要项，需先用人话解释清楚，再继续作答。问题[{user_query}]。' }, // 仅user_query
                    { template: '你是一个10年编程培训师，你回答时必须直击最底层---你应该先直白的讲解最核心的底层原理，拆解问题---你需要将底层原理拆解为若干流程，并提出每个流程的核心问题，回答问题---详细按照流程回答拆解出的核心问题，保持语言的直白，回顾总结---以终为始，回扣底层原理。禁止使用比喻，表格，大段代码，使用专业名词，确保每个名词都是一看就懂。若某一基础词汇是理解的必要项，需先用人话解释清楚，再继续作答。代码[{context}]。' }, // 仅user_query
                    { template: '你是一个10年编程培训师，你回答时必须直击最底层---你应该先直白的讲解最核心的底层原理，拆解问题---你需要将底层原理拆解为若干流程，并提出每个流程的核心问题，回答问题---详细按照流程回答拆解出的核心问题，保持语言的直白，回顾总结---以终为始，回扣底层原理。禁止使用比喻，表格，大段代码，使用专业名词，确保每个名词都是一看就懂。若某一基础词汇是理解的必要项，需先用人话解释清楚，再继续作答。参考网址[{cur_url}]。' }, // 仅user_query
                ]
            },
            // {
            //     name: '翻译场景组', // 分组名称3（用户可选择）
            //     templates: [       // 该分组下的模板列表
            //         { template: '翻译[{context}]为英文（来自网页[{cur_url}]）' }, // context+cur_url
            //         { template: '翻译[{user_query}]为多国语言' } // 仅user_query
            //     ]
            // }
        ],
        windowConfig: {
            width: 450,
            height: 800,
            gap: 20,
            baseTop: 100,
            maxColumns: 3
        },
        localApi: 'http://127.0.0.1:3000/ai-prompt' // 本地接口地址
    };

    // 工具函数：提取纯文本（原版保留）
    function extractPureText(str) {
        if (!str) return '';
        return str.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
    }

    // 核心工具：判断字符串是否为空（null/空字符串/全空格都算空）
    function isEmpty(str) {
        return str === null || str === undefined || str.trim() === '';
    }

    // 核心工具：解析模板中的变量（比如从"[{cur_url}]"提取出cur_url）
    function getVariablesFromTemplate(template) {
        const regex = /\{(\w+)\}/g;
        const variables = new Set();
        let match;
        while ((match = regex.exec(template)) !== null) {
            variables.add(match[1]);
        }
        return variables;
    }

    // 构建面板（新增URL复选框）
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
        title.textContent = 'AI极简提问助手 v3.7';
        panel.appendChild(title);

        // AI平台选择（原版保留）
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

        // Prompt模板分组选择（恢复可选择，展示分组名称）
        const promptSetWrapper = document.createElement('div');
        promptSetWrapper.style.cssText = 'margin-bottom: 15px; display: flex; flex-direction: column; gap: 6px;';
        promptSetWrapper.innerHTML = `
            <label style="font-size: 14px; color: #666;">选择Prompt模板分组（自动匹配该组内模板）：</label>
            <select id="prompt-set-select" style="padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 14px; outline: none; width: 100%; box-sizing: border-box;">
                ${CONFIG.promptSets.map((set, index) => `<option value="${index}">${set.name}</option>`).join('')}
            </select>
        `;
        panel.appendChild(promptSetWrapper);

        // 上下文编辑（原版保留）
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

        // 预设提问词（原版保留）
        const presetQueriesWrapper = document.createElement('div');
        presetQueriesWrapper.style.cssText = 'margin-bottom: 15px; display: flex; flex-direction: column; gap: 6px;';
        presetQueriesWrapper.innerHTML = `
            <label style="font-size: 14px; color: #666;">预测提问词（点击自动填入）：</label>
            <div id="preset-queries-container" style="display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px;">
                ${CONFIG.presetQueries.map(query => `<span style="padding: 4px 10px; background: #eef2ff; color: #2563eb; border-radius: 4px; font-size: 13px; cursor: pointer; transition: background 0.2s;">${query}</span>`).join('')}
            </div>
        `;
        panel.appendChild(presetQueriesWrapper);

        // 问题输入（原版保留）
        const inputWrapper = document.createElement('div');
        inputWrapper.style.cssText = 'margin-bottom: 20px; display: flex; flex-direction: column; gap: 6px;';
        inputWrapper.innerHTML = `
            <label style="font-size: 14px; color: #666;">您的问题：</label>
            <input type="text" id="ai-question-input" placeholder="请输入要提问的内容（可空）..."
                style="padding: 10px; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 14px; outline: none; width: 100%; box-sizing: border-box;">
        `;
        panel.appendChild(inputWrapper);

        // 按钮组（新增「包含当前网页URL」复选框，放在取消按钮左侧）
        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end; align-items: center;';
        btnGroup.innerHTML = `
            <label style="display: flex; align-items: center; gap: 4px; color: #333; font-size: 14px; cursor: pointer;">
                <input type="checkbox" id="ai-include-url-checkbox" checked style="cursor: pointer; width: 16px; height: 16px;">
                <span>包含当前网页URL</span>
            </label>
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

        // 遮罩层（原版保留）
        const mask = document.createElement('div');
        mask.id = 'ai-assistant-mask';
        mask.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.5); z-index: 999998;
        `;

        document.body.appendChild(mask);
        document.body.appendChild(panel);

        // 上下文计数更新（原版保留）
        const contextTextarea = document.getElementById('current-context');
        const countTextEl = document.getElementById('context-count-text');
        function updateContextCount() {
            const rawText = contextTextarea.value;
            const pureTextLength = extractPureText(rawText).length;
            countTextEl.textContent = `纯文字计数：${pureTextLength}（无长度限制）`;
        }
        contextTextarea.addEventListener('input', updateContextCount);

        // 预设提问词点击事件（原版保留）
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

        // 关闭面板事件（原版保留）
        document.getElementById('ai-cancel-btn').addEventListener('click', closePanel);
        mask.addEventListener('click', closePanel);
        panel.addEventListener('click', e => e.stopPropagation());
        document.addEventListener('keydown', escClosePanel);

        return panel;
    }

    // 关闭面板（原版保留）
    function closePanel() {
        const panel = document.getElementById('ai-assistant-panel');
        const mask = document.getElementById('ai-assistant-mask');
        if (panel) panel.remove();
        if (mask) mask.remove();
        document.activeElement.blur();
        document.removeEventListener('keydown', escClosePanel);
    }

    // ESC关闭面板（原版保留）
    function escClosePanel(e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
            closePanel();
        }
    }

    // 核心重构：按选中分组自动匹配模板并构建Prompt（新增URL复选框逻辑）
    function buildPrompt(userQuery, currentUrl) {
        // 1. 获取用户选中的模板分组
        const promptSetSelect = document.getElementById('prompt-set-select');
        const selectedGroupIndex = parseInt(promptSetSelect.value);
        const selectedGroup = CONFIG.promptSets[selectedGroupIndex];
        if (!selectedGroup || !selectedGroup.templates) {
            alert('❌ 所选模板分组无效！');
            throw new Error('无效的模板分组');
        }

        // 2. 获取URL复选框状态，决定是否使用当前网页URL
        const includeUrlCheckbox = document.getElementById('ai-include-url-checkbox');
        const includeUrl = includeUrlCheckbox?.checked || false;
        // 勾选则用当前URL，不勾选则置为空字符串
        const currentUrlValue = includeUrl ? currentUrl : '';

        // 3. 获取当前变量值（去空格后判断空值）
        const contextTextarea = document.getElementById('current-context');
        const context = contextTextarea.value || '';
        const userQueryTrimmed = userQuery || '';
        const currentUrlTrimmed = currentUrlValue || '';

        // 4. 确定当前非空变量集合（全空格算空）
        const nonEmptyVariables = new Set();
        if (!isEmpty(userQueryTrimmed)) nonEmptyVariables.add('user_query');
        if (!isEmpty(context)) nonEmptyVariables.add('context');
        if (!isEmpty(currentUrlTrimmed)) nonEmptyVariables.add('cur_url');

        // 5. 在选中分组内，找第一个完全匹配的模板
        let matchedTemplate = null;
        for (const templateItem of selectedGroup.templates) {
            const templateVars = getVariablesFromTemplate(templateItem.template);
            // 判断：模板变量集合 和 非空变量集合 完全相等
            if (
                templateVars.size === nonEmptyVariables.size &&
                [...templateVars].every(varName => nonEmptyVariables.has(varName))
            ) {
                matchedTemplate = templateItem.template;
                break; // 找到第一个匹配的就停止
            }
        }

        // 6. 无匹配模板则报错
        if (!matchedTemplate) {
            const nonEmptyList = [...nonEmptyVariables].join('、') || '无';
            alert(`❌ 所选「${selectedGroup.name}」分组内无匹配模板！当前非空变量：${nonEmptyList}`);
            throw new Error(`分组${selectedGroup.name}内无匹配模板，非空变量：${nonEmptyList}`);
        }

        // 7. 替换模板变量生成最终Prompt
        return matchedTemplate
            .replace(/{cur_url}/g, currentUrlTrimmed)
            .replace(/{context}/g, context)
            .replace(/{user_query}/g, userQueryTrimmed);
    }

    // 计算窗口位置（原版保留）
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

    // 打开AI窗口（原版保留，千问特殊处理）
    function openAIWindow(url, w, positionTracker, prompt = '') {
        const { width, height } = CONFIG.windowConfig;
        const { left, top } = calculateNextWindowPosition(positionTracker);
        let finalUrl = `${url}?w=${w}`; // 基础拼接w参数

        // 如果是千问平台且有prompt，拼接?q参数
        if (w === 'qianwen' && prompt) {
            finalUrl = `${url}?q=${encodeURIComponent(prompt)}&w=${w}`;
        }

        window.open(
            finalUrl,
            `AI_Assistant_Window_${Date.now()}`,
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
    }

    // POST到本地接口（原版保留）
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

    // 核心触发逻辑（原版保留，适配新的buildPrompt）
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
                try {
                    const userQuery = questionInput.value.trim();
                    // 构建Prompt（按选中分组自动匹配模板）
                    const promptText = buildPrompt(userQuery, currentUrl);
                    const selectedAIIndices = Array.from(document.querySelectorAll('input[name="ai-platform"]:checked')).map(el => el.value);
                    const windowPositionTracker = {
                        lastLeft: window.screen.width - CONFIG.windowConfig.width - 10,
                        columnCount: 0,
                        rowCount: 0
                    };

                    // 分离千问平台和其他平台
                    const qianwenIndex = selectedAIIndices.find(idx => CONFIG.aiPlatforms[idx].w === 'qianwen');
                    const otherIndices = selectedAIIndices.filter(idx => CONFIG.aiPlatforms[idx].w !== 'qianwen');

                    // 1. 处理非千问平台：先POST接口，再打开窗口
                    if (otherIndices.length > 0) {
                        const postOk = await postPromptToLocal(promptText);
                        if (!postOk) return; // 接口失败则终止

                        otherIndices.forEach(idx => {
                            const platform = CONFIG.aiPlatforms[idx];
                            openAIWindow(platform.value, platform.w, windowPositionTracker);
                        });
                    }

                    // 2. 处理千问平台：跳过POST，直接拼接URL
                    if (qianwenIndex !== undefined) {
                        const platform = CONFIG.aiPlatforms[qianwenIndex];
                        openAIWindow(platform.value, platform.w, windowPositionTracker, promptText);
                    }

                    closePanel();
                } catch (err) {
                    // 捕获模板匹配失败的错误，不关闭面板
                    console.error('提交失败：', err);
                }
            });

            questionInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') submitBtn.click();
            });
        }
    }, true);

    console.log('✅ AI极简提问助手 v3.7已加载（URL复选框+分组式模板+自动匹配+空值含全空格）');
    console.log('💡 触发：Alt+d | 退出：ESC | 千问直接拼接?q=prompt，其他平台POST本地接口');
})();