// 游戏状态管理
class GameState {
    constructor() {
        this.currentStage = null;
        this.ingredients = [];
        this.tools = [];
        this.timer = null;
        this.timeLeft = 0;
        this.progress = 0;
        this.allItemsData = null; // 存储all_items.json数据
        this.toolContents = {}; // 存储每个工具中的食材和容量
        this.recipes = null; // 存储recipe.json数据
    }
}

// Emoji映射函数 - 从all_items.json中获取emoji
function getIngredientEmoji(name) {
    const allItems = gameManager?.state?.allItemsData;
    if (!allItems) return '🥘';
    
    // 搜索所有分类
    const categories = ['ingredients', 'tools', 'spice'];
    for (const category of categories) {
        const item = allItems[category]?.find(item => item.name === name);
        if (item && item.emoji) return item.emoji;
    }
    
    return '🥘'; // 默认emoji
}

function getToolEmoji(name) {
    return getIngredientEmoji(name);
}

// 游戏管理器
class GameManager {
    constructor() {
        this.state = new GameState();
        this.init();
        
        // 初始化本地存储数据
        this.initLocalStorage();
    }
    
    initLocalStorage() {
        // 初始化健康值和储蓄值
        if (!localStorage.getItem('health')) {
            localStorage.setItem('health', 100);
        }
        if (!localStorage.getItem('savings')) {
            localStorage.setItem('savings', 0);
        }
    }

    async init() {
        try {
            // 从URL参数获取关卡ID，默认使用stage1
            const urlParams = new URLSearchParams(window.location.search);
            const stageId = urlParams.get('stage') || 'stage1';
            
            await this.loadAllItemsData();
            await this.loadRecipes();
            await this.loadStage(stageId);
            this.setupEventListeners();
            
            // 显示预对话
            await this.showPreDialog();
            
            // 预对话结束后显示关卡目标
            await this.showGoalsModal();
            
            // 用户确认后开始计时器
            this.startTimer();
        } catch (error) {
            console.error('游戏初始化失败:', error);
            this.showError('游戏加载失败，请刷新页面重试');
        }
    }

    async loadAllItemsData() {
        try {
            const response = await fetch('all_items.json');
            if (!response.ok) {
                throw new Error('all_items.json文件不存在');
            }
            this.state.allItemsData = await response.json();
        } catch (error) {
            console.error('加载物品数据失败:', error);
            this.state.allItemsData = { ingredients: [], tools: [], spice: [] };
        }
    }

    async loadRecipes() {
        try {
            const response = await fetch('recipe.json');
            if (!response.ok) {
                throw new Error('recipe.json文件不存在');
            }
            this.state.recipes = await response.json();
        } catch (error) {
            console.error('加载菜谱数据失败:', error);
            this.state.recipes = [];
        }
    }

    async loadStage(stageId) {
        try {
            const response = await fetch(`stages/${stageId}.json`);
            if (!response.ok) {
                throw new Error(`关卡文件不存在: ${stageId}`);
            }
            
            this.state.currentStage = await response.json();
            this.renderStage();
        } catch (error) {
            console.error('加载关卡失败:', error);
            // 使用默认数据
            this.state.currentStage = {
                stageName: "默认关卡",
                description: "欢迎来到时光菜谱！",
                ingredients: [
                    { name: "鸡蛋", quantity: 2 },
                    { name: "盐", quantity: "适量" },
                    { name: "食用油", quantity: "适量" }
                ],
                tools: ["平底锅", "铲子"],
                timeLimit: 40
            };
            this.renderStage();
        }
    }

    renderStage() {
        const stage = this.state.currentStage;
        
        // 更新关卡信息
        document.getElementById('level-name').textContent = stage.stageName;
        document.getElementById('timer-display').textContent = this.formatTime(stage.timeLimit);
        this.state.timeLeft = stage.timeLimit;

        // 渲染食材
        this.renderIngredients();
        
        // 渲染厨具
        this.renderTools();
    }

    renderIngredients() {
        const grid = document.getElementById('ingredients-grid');
        grid.innerHTML = '';

        this.state.currentStage.ingredients.forEach((ingredient, index) => {
            const ingredientData = this.state.allItemsData.ingredients.find(i => i.name === ingredient.name) ||
                                 this.state.allItemsData.spice.find(s => s.name === ingredient.name);
            
            // 为新添加的食材（如烤焦的食物、烤熟的食材等）提供默认值
            const enrichedIngredient = {
                ...ingredient,
                size: ingredientData?.size || 100
            };
            
            const card = this.createIngredientCard(enrichedIngredient, index);
            grid.appendChild(card);
        });
    }

    createIngredientCard(ingredient, index) {
        const card = document.createElement('div');
        card.className = 'ingredient-card';
        card.draggable = true;
        card.dataset.ingredientIndex = index;
        card.dataset.ingredientName = ingredient.name;
        card.dataset.ingredientSize = ingredient.size || 100;

        const emoji = getIngredientEmoji(ingredient.name);
        
        card.innerHTML = `
            <span class="ingredient-emoji">${emoji}</span>
            <div class="ingredient-name">${ingredient.name}</div>
            <div class="ingredient-quantity">${ingredient.quantity}</div>
            <div class="ingredient-size">体积: ${ingredient.size || 100}</div>
        `;

        // 添加拖拽事件
        card.addEventListener('dragstart', (e) => this.handleDragStart(e));
        card.addEventListener('dragend', (e) => this.handleDragEnd(e));

        // 添加悬停提示
        this.addHoverTooltip(card, ingredient);

        return card;
    }

    renderTools() {
        const grid = document.getElementById('tools-grid');
        grid.innerHTML = '';

        this.state.currentStage.tools.forEach((toolName, index) => {
            const toolData = this.state.allItemsData.tools.find(t => t.name === toolName);
            if (!toolData) return;
            
            // 初始化工具内容
            if (!this.state.toolContents[toolName]) {
                this.state.toolContents[toolName] = {
                    items: [],
                    usedCapacity: 0,
                    maxCapacity: toolData.capacity || 1000
                };
            }
            
            const enrichedTool = {
                name: toolName,
                capacity: toolData.capacity || 1000
            };
            
            const tool = this.createToolItem(enrichedTool, index);
            grid.appendChild(tool);
        });
    }

    createToolItem(tool, index) {
        const toolDiv = document.createElement('div');
        toolDiv.className = 'tool-item';
        toolDiv.dataset.toolIndex = index;
        toolDiv.dataset.toolName = tool.name;
        toolDiv.dataset.toolCapacity = tool.capacity || 1000;

        const emoji = getToolEmoji(tool.name);
        
        const toolContent = this.state.toolContents[tool.name] || { usedCapacity: 0, maxCapacity: tool.capacity };
        const usagePercent = (toolContent.usedCapacity / toolContent.maxCapacity) * 100;
        
        let capacityClass = '';
        if (usagePercent >= 90) {
            capacityClass = 'danger';
        } else if (usagePercent >= 75) {
            capacityClass = 'warning';
        }

        const itemsDisplay = toolContent.items
            .map(item => `${getIngredientEmoji(item.name)} ${item.name}`)
            .join(', ');

        toolDiv.innerHTML = `
            <span class="tool-emoji">${emoji}</span>
            <div class="tool-name">${tool.name}</div>
            <div class="tool-capacity ${capacityClass}">${toolContent.usedCapacity}/${toolContent.maxCapacity}</div>
            <div class="tool-content" id="tool-content-${index}">${itemsDisplay || '空'}</div>
            <button class="start-cooking-btn-small" onclick="gameManager.startToolCooking('${tool.name}')">开始烹饪</button>
            <button class="dump-btn-small" style="display: none;" onclick="gameManager.dumpToolIngredients('${tool.name}')">倒出食材</button>
            <div class="tool-progress" style="display: none;">
                <div class="tool-progress-fill"></div>
            </div>
            <div class="tool-timer" style="display: none;"></div>
        `;

        // 添加拖拽区域事件
        toolDiv.addEventListener('dragover', (e) => this.handleDragOver(e));
        toolDiv.addEventListener('drop', (e) => this.handleDrop(e));
        toolDiv.addEventListener('dragleave', (e) => this.handleDragLeave(e));

        // 添加点击事件用于倒出食材
        toolDiv.addEventListener('click', (e) => {
            if (e.target.classList.contains('start-cooking-btn-small') || 
                e.target.classList.contains('dump-btn-small')) {
                return; // 避免按钮点击冲突
            }
            
            // 如果正在烹饪，点击厨具倒出食材
            if (this.cookingProgress[tool.name] && this.cookingProgress[tool.name].isCooking) {
                this.dumpToolIngredients(tool.name);
            }
        });

        return toolDiv;
    }

    addHoverTooltip(element, ingredient) {
        const tooltip = document.getElementById('tooltip');
        
        element.addEventListener('mouseenter', (e) => {
            const rect = element.getBoundingClientRect();
            tooltip.style.left = rect.left + rect.width / 2 + 'px';
            tooltip.style.top = rect.top - 30 + 'px';
            tooltip.style.transform = 'translateX(-50%)';
            
            tooltip.querySelector('.tooltip-content').textContent = 
                `${ingredient.name} - ${ingredient.quantity}`;
            tooltip.style.display = 'block';
        });

        element.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });
    }

    // 拖拽事件处理
    handleDragStart(e) {
        e.target.classList.add('dragging');
        const data = {
            type: 'ingredient',
            index: e.target.dataset.ingredientIndex,
            name: e.target.dataset.ingredientName,
            size: parseInt(e.target.dataset.ingredientSize) || 100
        };
        e.dataTransfer.setData('text/plain', JSON.stringify(data));
        e.dataTransfer.effectAllowed = 'move';
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
    }

    handleDragOver(e) {
        e.preventDefault();
        
        const data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');
        const toolName = e.currentTarget.dataset.toolName;
        const toolContent = this.state.toolContents[toolName];
        
        if (data && data.type === 'ingredient' && toolContent) {
            const newUsedCapacity = toolContent.usedCapacity + data.size;
            
            if (newUsedCapacity <= toolContent.maxCapacity) {
                e.currentTarget.classList.add('drag-over');
                e.dataTransfer.dropEffect = 'move';
            } else {
                e.currentTarget.classList.add('capacity-full');
                e.dataTransfer.dropEffect = 'none';
            }
        }
    }

    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
        e.currentTarget.classList.remove('capacity-full');
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');

        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const toolIndex = e.currentTarget.dataset.toolIndex;
        const toolName = e.currentTarget.dataset.toolName;
        
        if (data && data.type === 'ingredient' && toolIndex) {
            const toolContent = this.state.toolContents[toolName];
            if (toolContent && (toolContent.usedCapacity + data.size) <= toolContent.maxCapacity) {
                this.addIngredientToTool(data.index, toolIndex, data.size);
            } else {
                alert('工具容量不足！');
            }
        }
    }

    addIngredientToTool(ingredientIndex, toolIndex, size) {
        const ingredient = this.state.currentStage.ingredients[ingredientIndex];
        const toolName = this.state.currentStage.tools[toolIndex];
        
        // 检查食材数量是否足够
        let currentQuantity = 0;
        if (typeof ingredient.quantity === 'number') {
            currentQuantity = ingredient.quantity;
        } else if (typeof ingredient.quantity === 'string' && ingredient.quantity.includes('适量')) {
            // 对于适量的情况，默认给一个较大的数量
            currentQuantity = 1;
        } else {
            // 其他情况默认1
            currentQuantity = 114514;
        }
        
        if (currentQuantity <= 0) {
            alert('食材数量不足！');
            return;
        }
        
        // 减少食材数量
        if (typeof ingredient.quantity === 'number') {
            ingredient.quantity = currentQuantity - 1;
        } else if (typeof ingredient.quantity === 'string' && ingredient.quantity.includes('适量')) {
            ingredient.quantity = 0;
        }
        
        // 创建食材显示元素
        const ingredientElement = document.createElement('div');
        ingredientElement.className = 'cooking-ingredient';
        ingredientElement.innerHTML = `
            <span class="ingredient-emoji">${getIngredientEmoji(ingredient.name)}</span>
            <span class="ingredient-name">${ingredient.name}</span>
            <span class="ingredient-quantity">×1</span>
        `;
        
        // 添加到烹饪区域
        const toolContent = document.getElementById(`tool-content-${toolIndex}`);
        if (toolContent) {
            toolContent.appendChild(ingredientElement);
        }
        
        // 更新工具容量
        if (this.state.toolContents[toolName]) {
            this.state.toolContents[toolName].items.push({
                name: ingredient.name,
                size: size
            });
            this.state.toolContents[toolName].usedCapacity += size;
            
            // 添加营养值到健康值
            const ingredientData = this.state.allItemsData.ingredients.find(i => i.name === ingredient.name);
            if (ingredientData && ingredientData.nutrition) {
                const currentHealth = parseInt(localStorage.getItem('health')) || 100;
                const newHealth = currentHealth + ingredientData.nutrition;
                localStorage.setItem('health', newHealth);
            }
            
            // 更新容量显示
            const toolDiv = document.querySelector(`[data-tool-index="${toolIndex}"]`);
            if (toolDiv) {
                const capacityDiv = toolDiv.querySelector('.tool-capacity');
                const usedCapacity = this.state.toolContents[toolName].usedCapacity;
                const maxCapacity = this.state.toolContents[toolName].maxCapacity;
                const usagePercent = (usedCapacity / maxCapacity) * 100;
                
                let capacityClass = '';
                if (usagePercent >= 90) {
                    capacityClass = 'danger';
                } else if (usagePercent >= 75) {
                    capacityClass = 'warning';
                }
                
                capacityDiv.textContent = `${usedCapacity}/${maxCapacity}`;
                capacityDiv.className = `tool-capacity ${capacityClass}`;
                
                // 更新工具内容显示
                const contentDiv = toolDiv.querySelector('.tool-content');
                if (contentDiv) {
                    const itemsDisplay = this.state.toolContents[toolName].items
                        .map(item => `${getIngredientEmoji(item.name)} ${item.name}`)
                        .join(', ');
                    contentDiv.textContent = itemsDisplay || '空';
                }
            }
        }
        
        // 更新食材显示 - 如果数量为0则隐藏卡片
        const ingredientCard = document.querySelector(`[data-ingredient-index="${ingredientIndex}"]`);
        if (ingredientCard) {
            const quantityDiv = ingredientCard.querySelector('.ingredient-quantity');
            if (quantityDiv) {
                quantityDiv.textContent = ingredient.quantity;
            }
            
            // 如果数量为0，隐藏卡片
            if (typeof ingredient.quantity === 'number' && ingredient.quantity <= 0) {
                ingredientCard.style.display = 'none';
                ingredientCard.style.opacity = '0.5';
                ingredientCard.draggable = false;
            }
        }
        
        // 更新进度
        this.updateProgress();
    
        // 更新厨具下拉框
        this.populateToolSelect();
    
        // 更新工具显示
        this.updateToolDisplay(toolName);
    }

    updateProgress() {
        // 基于stage中的targets计算进度
        if (!this.state.currentStage || !this.state.currentStage.targets) {
            this.state.progress = 0;
            document.getElementById('progress-fill').style.width = '0%';
            document.getElementById('progress-text').textContent = '0%';
            return;
        }

        const targets = this.state.currentStage.targets;
        const availableIngredients = this.state.currentStage.ingredients;
        
        // 计算已完成的targets数量
        let completedTargets = 0;
        targets.forEach(target => {
            const ingredient = availableIngredients.find(i => i.name === target);
            if (ingredient && ingredient.quantity > 0) {
                completedTargets++;
            }
        });

        // 计算进度百分比
        this.state.progress = Math.min((completedTargets / targets.length) * 100, 100);
        
        document.getElementById('progress-fill').style.width = `${this.state.progress}%`;
        document.getElementById('progress-text').textContent = `${Math.round(this.state.progress)}%`;
        
        // 检查是否达到100%进度
        if (this.state.progress >= 100) {
            this.showCompletionModal();
        }
    }

    async showGoalsModal() {
        const stage = this.state.currentStage;
        if (!stage.goals || stage.goals.length === 0) {
            return; // 如果没有目标，直接返回
        }

        return new Promise((resolve) => {
            const modal = document.getElementById('goals-modal');
            const goalsList = document.getElementById('goals-list');
            const timeDisplay = document.getElementById('goals-time-display');
            const startBtn = document.getElementById('goals-start-btn');

            // 清空并填充目标列表
            goalsList.innerHTML = '';
            stage.goals.forEach(goal => {
                const goalItem = document.createElement('div');
                goalItem.className = 'goal-item';
                goalItem.textContent = goal;
                goalsList.appendChild(goalItem);
            });

            // 设置时间限制显示
            timeDisplay.textContent = this.formatTime(stage.timeLimit);

            // 显示模态框
            modal.style.display = 'flex';

            // 点击开始按钮
            const handleStart = () => {
                modal.style.display = 'none';
                startBtn.removeEventListener('click', handleStart);
                resolve();
            };

            startBtn.addEventListener('click', handleStart);

            // 按空格键也可以开始
            const handleKeyPress = (e) => {
                if (e.code === 'Space') {
                    e.preventDefault();
                    modal.style.display = 'none';
                    document.removeEventListener('keydown', handleKeyPress);
                    startBtn.removeEventListener('click', handleStart);
                    resolve();
                }
            };
            document.addEventListener('keydown', handleKeyPress);
        });
    }

    async showPreDialog() {
        const stage = this.state.currentStage;
        if (!stage.predialog || stage.predialog.length === 0) {
            return; // 如果没有预对话，直接返回
        }

        const dialogLayer = document.getElementById('predialog-layer');
        const characterName = document.getElementById('character-name-bottom');
        const dialogContent = document.getElementById('dialog-content-bottom');
        const characterImage = document.getElementById('character-image-full');

        let currentDialogIndex = 0;
        let typedInstance = null;
        let isTyping = false;

        return new Promise((resolve) => {
            const showCurrentDialog = () => {
                if (currentDialogIndex >= stage.predialog.length) {
                    dialogLayer.style.display = 'none';
                    resolve();
                    return;
                }

                const dialog = stage.predialog[currentDialogIndex];
                characterName.textContent = dialog.name;
                characterImage.src = `assets/characters/${dialog.character}.png`;
                dialogLayer.style.display = 'flex';

                // 清除之前的打字机实例
                if (typedInstance) {
                    typedInstance.destroy();
                }

                // 设置打字机效果
                isTyping = true;
                dialogContent.textContent = '';
                
                typedInstance = new Typed(dialogContent, {
                    strings: [dialog.content],
                    typeSpeed: 50,
                    backSpeed: 0,
                    loop: false,
                    showCursor: false,
                    onComplete: () => {
                        isTyping = false;
                    }
                });
            };

            const nextDialog = () => {
                // 如果正在打字，直接显示完整文本
                if (isTyping && typedInstance) {
                    typedInstance.stop();
                    dialogContent.textContent = stage.predialog[currentDialogIndex].content;
                    isTyping = false;
                    return;
                }
                
                currentDialogIndex++;
                showCurrentDialog();
            };

            // 点击对话区域切换
            dialogLayer.addEventListener('click', nextDialog);

            // 空格键切换对话
            const handleKeyPress = (e) => {
                if (e.code === 'Space') {
                    e.preventDefault();
                    nextDialog();
                }
            };
            document.addEventListener('keydown', handleKeyPress);

            // 清理事件监听器
            const cleanup = () => {
                dialogLayer.removeEventListener('click', nextDialog);
                document.removeEventListener('keydown', handleKeyPress);
                if (typedInstance) {
                    typedInstance.destroy();
                }
            };

            // 在对话结束时清理事件监听器
            const originalShowCurrentDialog = showCurrentDialog;
            const showCurrentDialogWithCleanup = () => {
                if (currentDialogIndex >= stage.predialog.length) {
                    cleanup();
                    originalShowCurrentDialog();
                    return;
                }
                originalShowCurrentDialog();
            };

            // 显示第一个对话
            showCurrentDialogWithCleanup();
        });
    }

    startTimer() {
        this.timer = setInterval(() => {
            this.state.timeLeft--;
            document.getElementById('timer-display').textContent = this.formatTime(this.state.timeLeft);
            
            if (this.state.timeLeft <= 0) {
                this.gameOver();
            }
        }, 1000);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    gameOver() {
        clearInterval(this.timer);
        this.showCompletionModal();
    }
    
    async showCompletionModal() {
        const progress = Math.round(this.state.progress);
        
        // 根据进度计算奖励
        let reward = 0;
        let title = "";
        let message = "";
        
        if (progress >= 100) {
            // 完美完成
            title = "🎉 完美通关！";
            message = "恭喜你成功完成了所有目标！";
            if (this.state.currentStage && this.state.currentStage.reward) {
                if (typeof this.state.currentStage.reward === 'object') {
                    reward = this.state.currentStage.reward.coins || 50;
                } else {
                    reward = this.state.currentStage.reward || 50;
                }
            } else {
                reward = 50; // 默认奖励
            }
        } else if (progress >= 80) {
            // 优秀完成
            title = "👏 优秀完成！";
            message = "你完成了大部分目标，表现很棒！";
            reward = Math.floor(progress * 0.4); // 40%的奖励
        } else if (progress >= 50) {
            // 良好完成
            title = "👍 良好完成！";
            message = "你完成了部分目标，继续加油！";
            reward = Math.floor(progress * 0.2); // 20%的奖励
        } else if (progress > 0) {
            // 未完成
            title = "😔 未完成";
            message = "你还需要继续努力，下次一定能做得更好！";
            reward = 0; // 没有奖励
        } else {
            // 零进度
            title = "😢 时间到！";
            message = "时间用完了，下次记得更快完成任务！";
            reward = 0; // 没有奖励
        }
        
        // 更新储蓄值
        const currentSavings = parseInt(localStorage.getItem('savings')) || 0;
        const newSavings = currentSavings + reward;
        localStorage.setItem('savings', newSavings);

        // 记录获得的食谱
        if (progress >= 50 && this.state.currentStage && this.state.currentStage.reward && this.state.currentStage.reward.recipeBook) {
            const newRecipes = this.state.currentStage.reward.recipeBook;
            const existingRecipes = JSON.parse(localStorage.getItem('recipes') || '[]');
            const allRecipes = [...new Set([...existingRecipes, ...newRecipes])];
            localStorage.setItem('recipes', JSON.stringify(allRecipes));
        }
        
        // 创建模态框
        const modal = document.createElement('div');
        modal.id = 'completion-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 40px;
            border-radius: 15px;
            text-align: center;
            max-width: 400px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;
        
        let rewardHtml = reward > 0 ? `
            <div style="margin-bottom: 20px;">
                <strong>获得金币：</strong>
                <span style="color: #ff6b6b; font-size: 24px; font-weight: bold;">💰 ${reward}</span>
            </div>
        ` : '';
        
        modalContent.innerHTML = `
            <h2 style="color: #333; margin-bottom: 20px;">${title}</h2>
            <div style="margin-bottom: 15px;">
                <strong>完成度：</strong>
                <span style="color: ${progress >= 50 ? '#28a745' : '#ffc107'}; font-size: 24px; font-weight: bold;">${progress}%</span>
            </div>
            <div style="margin-bottom: 20px; color: #666; font-size: 16px;">
                ${message}
            </div>
            ${rewardHtml}
            <div style="margin-bottom: 25px;">
                <strong>总储蓄：</strong>
                <span style="color: #007bff; font-size: 20px; font-weight: bold;">💳 ${newSavings}</span>
            </div>
            <button onclick="this.parentElement.parentElement.remove();window.location.href = 'level_select.html';" 
                    style="background: #007bff; color: white; border: none; padding: 12px 30px; 
                           border-radius: 8px; font-size: 16px; cursor: pointer;">
                确定
            </button>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // 100%完成时添加纸屑特效
        if (progress >= 100) {
            // 创建canvas元素用于纸屑效果
            const canvas = document.createElement('canvas');
            canvas.style.position = 'fixed';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.pointerEvents = 'none';
            canvas.style.zIndex = '9999';
            document.body.appendChild(canvas);

            // 初始化confetti
            const confetti = new ConfettiGenerator({
                target: canvas,
                max: 150,
                size: 2,
                colors: [[255, 0, 0], [255, 115, 0], [255, 251, 0], [72, 255, 0], [0, 255, 213], [0, 43, 255], [122, 0, 255], [255, 0, 128]]
            });

            // 渲染纸屑
            confetti.render();

            // 3秒后清除纸屑
            setTimeout(() => {
                confetti.clear();
                document.body.removeChild(canvas);
            }, 3000);
        }
    }

    showRecipeModal() {
        const recipeModal = document.getElementById('recipe-modal');
        const recipeList = document.getElementById('recipe-list');
        
        if (!recipeModal || !recipeList) return;
        
        // 获取已解锁的食谱
        const unlockedRecipes = JSON.parse(localStorage.getItem('recipes') || '[]');
        
        // 清空食谱列表
        recipeList.innerHTML = '';
        
        if (unlockedRecipes.length === 0) {
            recipeList.innerHTML = '<div class="empty-recipes">还没有解锁任何食谱，继续游戏来解锁吧！</div>';
            recipeModal.style.display = 'flex';
            return;
        }
        
        // 渲染已解锁的食谱
        unlockedRecipes.forEach(recipeName => {
            const recipeData = this.state.recipes.find(r => r.name === recipeName);
            if (recipeData) {
                const recipeCard = this.createRecipeCard(recipeData);
                recipeList.appendChild(recipeCard);
            }
        });
        
        recipeModal.style.display = 'flex';
    }

    createRecipeCard(recipe) {
        const card = document.createElement('div');
        card.className = 'recipe-card';
        
        // 获取食谱的输入、工具和输出信息
        const inputItems = Object.entries(recipe.input).map(([name, quantity]) => ({
            name,
            quantity,
            emoji: getIngredientEmoji(name)
        }));
        
        const tools = recipe.tool.map(toolName => ({
            name: toolName,
            emoji: getToolEmoji(toolName)
        }));
        
        const outputItems = Object.entries(recipe.output).map(([name, quantity]) => ({
            name,
            quantity,
            emoji: getIngredientEmoji(name)
        }));
        
        // 构建食谱卡片HTML
        let inputsHtml = inputItems.map(item => `
            <div class="recipe-item">
                <span class="recipe-item-emoji">${item.emoji}</span>
                <div class="recipe-item-name">${item.name}</div>
                <div class="recipe-item-quantity">×${item.quantity}</div>
            </div>
        `).join('');
        
        let toolsHtml = tools.map(tool => `
            <div class="recipe-item">
                <span class="recipe-item-emoji">${tool.emoji}</span>
                <div class="recipe-item-name">${tool.name}</div>
            </div>
        `).join('');
        
        let outputsHtml = outputItems.map(item => `
            <div class="recipe-item">
                <span class="recipe-item-emoji">${item.emoji}</span>
                <div class="recipe-item-name">${item.name}</div>
                <div class="recipe-item-quantity">×${item.quantity}</div>
            </div>
        `).join('');
        
        card.innerHTML = `
            <div class="recipe-name">${recipe.name}</div>
            <div class="recipe-flow">
                <div class="recipe-ingredients">
                    <div style="font-size: 12px; color: #666; margin-bottom: 5px;">食材</div>
                    ${inputsHtml}
                </div>
                <div class="recipe-arrow">→</div>
                <div class="recipe-tool">
                    <div style="font-size: 12px; color: #666; margin-bottom: 5px;">工具</div>
                    ${toolsHtml}
                </div>
                <div class="recipe-arrow">→</div>
                <div class="recipe-output">
                    <div style="font-size: 12px; color: #666; margin-bottom: 5px;">成品</div>
                    ${outputsHtml}
                </div>
            </div>
        `;
        
        return card;
    }

    setupEventListeners() {
        // 初始化新的烹饪系统
        this.setupNewCookingSystem();
        
        // 食谱按钮事件绑定
        const recipeBtn = document.getElementById('recipe-btn');
        const recipeModal = document.getElementById('recipe-modal');
        const closeRecipeBtn = document.getElementById('close-recipe-modal');
        
        if (recipeBtn) {
            recipeBtn.addEventListener('click', () => this.showRecipeModal());
        }
        
        if (closeRecipeBtn) {
            closeRecipeBtn.addEventListener('click', () => {
                recipeModal.style.display = 'none';
            });
        }
        
        // 点击模态框外部关闭
        if (recipeModal) {
            recipeModal.addEventListener('click', (e) => {
                if (e.target === recipeModal) {
                    recipeModal.style.display = 'none';
                }
            });
        }
        
        // 防止页面刷新时丢失拖拽状态
        window.addEventListener('beforeunload', () => {
            if (this.timer) {
                clearInterval(this.timer);
            }
            // 清理所有烹饪计时器
            if (this.cookingTimers) {
                Object.values(this.cookingTimers).forEach(timer => clearInterval(timer));
            }
        });
    }

    setupNewCookingSystem() {
        // 初始化烹饪状态
        this.cookingTimers = {};
        this.cookingProgress = {};
        this.cookingStartTime = {};
        
        // 绑定开始全部烹饪按钮
        const startAllBtn = document.getElementById('start-all-cooking-btn');
        if (startAllBtn) {
            startAllBtn.addEventListener('click', () => {
                this.startAllCooking();
            });
        }
    }

    startAllCooking() {
        this.state.currentStage.tools.forEach(toolName => {
            const toolContents = this.state.toolContents[toolName];
            if (toolContents && toolContents.items.length > 0 && !this.cookingTimers[toolName]) {
                this.startToolCooking(toolName);
            }
        });
    }

    startToolCooking(toolName) {
        const toolData = this.state.allItemsData.tools.find(t => t.name === toolName);
        const toolContents = this.state.toolContents[toolName];
        
        if (!toolData || !toolContents || toolContents.items.length === 0) return;

        // 检查是否为不产生热源的工具（fire为-1）
        const isNonHeatingTool = toolData.fire === -1;
        
        let cookingTime;
        if (isNonHeatingTool) {
            // 对于不产生热源的工具，设置一个固定的时间（例如10秒）用于混合/处理
            cookingTime = 10;
        } else {
            // 计算烹饪时间 d = heating / fire（正确公式）
            const minHeating = Math.min(...toolContents.items.map(item => {
                const ingredientData = this.state.allItemsData.ingredients.find(i => i.name === item.name);
                return ingredientData ? ingredientData.heating : 30;
            }));
            cookingTime = Math.round((minHeating / toolData.fire)); // 使用最小heating值，更合理
        }
        
        this.cookingProgress[toolName] = {
            totalTime: cookingTime,
            remainingTime: cookingTime,
            isCooking: true
        };

        const toolIndex = this.state.currentStage.tools.indexOf(toolName);
        const toolDiv = document.querySelector(`[data-tool-index="${toolIndex}"]`);
        if (toolDiv) {
            toolDiv.classList.add('cooking');
            
            // 显示进度条和计时器
            const progressDiv = toolDiv.querySelector('.tool-progress');
            const timerDiv = toolDiv.querySelector('.tool-timer');
            const startBtn = toolDiv.querySelector('.start-cooking-btn-small');
            const dumpBtn = toolDiv.querySelector('.dump-btn-small');
            
            if (progressDiv) progressDiv.style.display = 'block';
            if (timerDiv) {
                timerDiv.style.display = 'block';
                timerDiv.textContent = `${cookingTime}秒`;
            }
            if (startBtn) startBtn.style.display = 'none';
            if (dumpBtn) dumpBtn.style.display = 'inline-block';
        }

        // 开始倒计时
        this.cookingTimers[toolName] = setInterval(() => {
            this.updateToolCooking(toolName);
        }, 1000);
    }

    updateToolCooking(toolName) {
        const progress = this.cookingProgress[toolName];
        if (!progress || !progress.isCooking) return;

        progress.remainingTime--;
        
        const progressPercent = ((progress.totalTime - progress.remainingTime) / progress.totalTime) * 100;
        
        const toolIndex = this.state.currentStage.tools.indexOf(toolName);
        const toolDiv = document.querySelector(`[data-tool-index="${toolIndex}"]`);
        if (toolDiv) {
            const progressFill = toolDiv.querySelector('.tool-progress-fill');
            const timerDiv = toolDiv.querySelector('.tool-timer');
            
            if (progressFill) progressFill.style.width = `${progressPercent}%`;
            if (timerDiv) timerDiv.textContent = `${progress.remainingTime}秒`;
        }

        if (progress.remainingTime <= 0) {
            const toolData = this.state.allItemsData.tools.find(t => t.name === toolName);
            const isNonHeatingTool = toolData && toolData.fire === -1;
            
            if (isNonHeatingTool) {
                // 对于不产生热源的工具，时间到后自动倒出食材（状态为生的，但不需要烤焦判断）
                this.finishToolCooking(toolName, 2);
            } else {
                // 正常烹饪工具，时间到后烤焦
                this.finishToolCooking(toolName, 0);
            }
        }
    }

    finishToolCooking(toolName, isCooked) {
        if (this.cookingTimers[toolName]) {
            clearInterval(this.cookingTimers[toolName]);
            delete this.cookingTimers[toolName];
        }

        const toolContents = this.state.toolContents[toolName];
        if (!toolContents) return;

        if (isCooked == 1) {
            // 检查是否匹配菜谱
            const matchedRecipe = this.checkRecipeMatch(toolContents.items, toolName);
            if (matchedRecipe) {
                // 匹配成功，返回菜谱输出
                this.returnRecipeOutput(matchedRecipe);
            } else {
                // 烤熟 - 将食材返回食材列表
                this.returnCookedIngredients(toolContents.items);
            }
        } else if (isCooked == 2) {
            // 检查是否匹配菜谱
            const matchedRecipe = this.checkRecipeMatch(toolContents.items, toolName);
            if (matchedRecipe) {
                // 匹配成功，返回菜谱输出
                this.returnRecipeOutput(matchedRecipe);
            } else {
                // 生的 - 将原始食材返回食材列表
                this.returnRawIngredients(toolContents.items);
            }
        } else {
            // 烤焦 - 将食材变为烤焦的食物
            this.returnBurnedIngredients(toolContents.items);
        }

        // 清空厨具
        this.state.toolContents[toolName] = {
            items: [],
            usedCapacity: 0,
            maxCapacity: this.state.toolContents[toolName].maxCapacity
        };

        // 重置UI
        this.resetToolUI(toolName);
    }

    checkRecipeMatch(items, toolName) {
        if (!this.state.recipes || this.state.recipes.length === 0) {
            return null;
        }

        // 获取工具中的食材名称和数量
        const toolIngredients = items.reduce((acc, item) => {
            acc[item.name] = (acc[item.name] || 0) + 1;
            return acc;
        }, {});
        
        // 检查每个菜谱
        for (const recipe of this.state.recipes) {
            // 检查工具是否匹配
            if (!recipe.tool.includes(toolName)) {
                continue;
            }
            
            const recipeInputs = recipe.input;
            const toolIngredientNames = Object.keys(toolIngredients);
            const recipeIngredientNames = Object.keys(recipeInputs);
            
            // 如果是抽象菜谱（通配符菜谱）
            if (recipe.abstract) {
                // 建立通配符映射
                const wildcardMap = {};
                let match = true;
                
                // 检查非通配符食材
                const nonWildcardIngredients = recipeIngredientNames.filter(name => !name.startsWith('{'));
                for (const ingredientName of nonWildcardIngredients) {
                    if (toolIngredients[ingredientName] !== recipeInputs[ingredientName]) {
                        match = false;
                        break;
                    }
                }
                
                // 检查通配符食材
                if (match) {
                    const wildcardIngredients = recipeIngredientNames.filter(name => name.startsWith('{'));
                    
                    // 收集剩余的食材
                    const remainingIngredients = { ...toolIngredients };
                    nonWildcardIngredients.forEach(name => {
                        delete remainingIngredients[name];
                    });
                    
                    // 匹配通配符
                    for (const wildcardName of wildcardIngredients) {
                        const wildcardKey = wildcardName;
                        const requiredCount = recipeInputs[wildcardKey];
                        
                        // 找到匹配的食材
                        const matchedIngredient = Object.keys(remainingIngredients).find(name => 
                            remainingIngredients[name] === requiredCount && 
                            !Object.values(wildcardMap).includes(name)
                        );
                        
                        if (matchedIngredient) {
                            wildcardMap[wildcardKey] = matchedIngredient;
                            delete remainingIngredients[matchedIngredient];
                        } else {
                            match = false;
                            break;
                        }
                    }
                }
                
                if (match) {
                    return { ...recipe, wildcardMap };
                }
            } else {
                // 普通菜谱的匹配逻辑
                if (toolIngredientNames.length === recipeIngredientNames.length &&
                    recipeIngredientNames.every(name => 
                        toolIngredients[name] === recipeInputs[name]
                    )) {
                    return recipe;
                }
            }
        }
        
        return null;
    }

    returnRecipeOutput(recipe) {
        // 处理通配符替换
        const wildcardMap = recipe.wildcardMap || {};
        
        // 将菜谱输出添加到食材列表
        const output = recipe.output;
        Object.keys(output).forEach(outputName => {
            let finalName = outputName;
            
            // 替换通配符
            Object.keys(wildcardMap).forEach(wildcard => {
                finalName = finalName.replace(wildcard, wildcardMap[wildcard]);
            });
            
            const quantity = output[outputName];
            const existingIngredient = this.state.currentStage.ingredients.find(i => i.name === finalName);
            if (existingIngredient) {
                existingIngredient.quantity = (existingIngredient.quantity || 0) + quantity;
            } else {
                this.state.currentStage.ingredients.push({
                    name: finalName,
                    quantity: quantity
                });
            }
        });
        
        this.renderIngredients();
        this.updateProgress();
        
        // 显示通配符替换后的菜名
        let displayName = recipe.name;
        Object.keys(wildcardMap).forEach(wildcard => {
            displayName = displayName.replace(wildcard, wildcardMap[wildcard]);
        });
        alert(`烹饪成功！制作了：${displayName}！`);
    }

    returnCookedIngredients(items) {
        // 将烤熟的食材返回可用食材列表
        items.forEach(item => {
            const existingIngredient = this.state.currentStage.ingredients.find(i => i.name === item.name + "(烤熟)");
            if (existingIngredient) {
                existingIngredient.quantity = (existingIngredient.quantity || 0) + 1;
            } else {
                this.state.currentStage.ingredients.push({
                    name: item.name + "(烤熟)",
                    quantity: 1
                });
            }
        });
        
        this.renderIngredients();
        this.updateProgress(); // 更新进度
        alert('烹饪成功！食材已返回食材列表！');
    }

    returnRawIngredients(items) {
        // 将生的食材返回可用食材列表
        items.forEach(item => {
            const existingIngredient = this.state.currentStage.ingredients.find(i => i.name === item.name);
            if (existingIngredient) {
                existingIngredient.quantity = (existingIngredient.quantity || 0) + 1;
            } else {
                this.state.currentStage.ingredients.push({
                    name: item.name,
                    quantity: 1
                });
            }
        });
        
        this.renderIngredients();
        alert('食材还是生的！已返回食材列表！');
    }

    returnBurnedIngredients(items) {
        // 将烤焦的食材返回食材列表
        const burnedItem = {
            name: '烤焦的食物',
            quantity: items.length
        };
        
        const existingBurned = this.state.currentStage.ingredients.find(i => i.name === '烤焦的食物');
        if (existingBurned) {
            existingBurned.quantity = (existingBurned.quantity || 0) + items.length;
        } else {
            this.state.currentStage.ingredients.push(burnedItem);
        }
        
        this.renderIngredients();
        alert('食物烤焦了！已返回为烤焦的食物！');
    }

    updateToolDisplay(toolName) {
        const toolIndex = this.state.currentStage.tools.indexOf(toolName);
        const toolDiv = document.querySelector(`[data-tool-index="${toolIndex}"]`);
        if (toolDiv) {
            const toolContent = this.state.toolContents[toolName];
            const contentDiv = toolDiv.querySelector('.tool-content');
            if (contentDiv && toolContent) {
                const itemsDisplay = toolContent.items
                    .map(item => `${getIngredientEmoji(item.name)} ${item.name}`)
                    .join(', ');
                contentDiv.textContent = itemsDisplay || '空';
            }
        }
    }
    
    populateToolSelect() {
        const select = document.getElementById('tool-select');
        if (select) {
            select.innerHTML = '';
            this.state.currentStage.tools.forEach(toolName => {
                const option = document.createElement('option');
                option.value = toolName;
                option.textContent = toolName;
                select.appendChild(option);
            });
        }
    }
    
    resetToolUI(toolName) {
        const toolIndex = this.state.currentStage.tools.indexOf(toolName);
        const toolDiv = document.querySelector(`[data-tool-index="${toolIndex}"]`);
        if (toolDiv) {
            toolDiv.classList.remove('cooking');
            
            const progressDiv = toolDiv.querySelector('.tool-progress');
            const timerDiv = toolDiv.querySelector('.tool-timer');
            const startBtn = toolDiv.querySelector('.start-cooking-btn-small');
            const dumpBtn = toolDiv.querySelector('.dump-btn-small');
            
            if (progressDiv) progressDiv.style.display = 'none';
            if (timerDiv) timerDiv.style.display = 'none';
            if (startBtn) startBtn.style.display = 'inline-block';
            if (dumpBtn) dumpBtn.style.display = 'none';
            
            // 重置进度条
            const progressFill = toolDiv.querySelector('.tool-progress-fill');
            if (progressFill) progressFill.style.width = '0%';
        }
        
        // 更新工具显示
    this.updateToolDisplay(toolName);
    
    // 更新厨具下拉框
    this.populateToolSelect();
    }

    // 点击厨具倒出食材
    dumpToolIngredients(toolName) {
        if (!this.cookingProgress[toolName] || !this.cookingProgress[toolName].isCooking) return;

        const progress = this.cookingProgress[toolName];
        const progressPercent = (progress.remainingTime / progress.totalTime) * 100;
        let isCooked;
        if (progressPercent >= 30) {
            isCooked = 2; // 生的
        } else if (progressPercent < 30 && progressPercent > 0) {
            isCooked = 1; // 烤熟
        } else {
            isCooked = 0; // 烤焦
        }

        this.finishToolCooking(toolName, isCooked);
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ff4444;
            color: white;
            padding: 20px;
            border-radius: 8px;
            z-index: 1000;
            text-align: center;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
    }
}

// 初始化游戏
let gameManager;

document.addEventListener('DOMContentLoaded', () => {
    gameManager = new GameManager();
});

// 导出供其他模块使用
window.GameManager = GameManager;