// 全局变量
let levelsData = {};

// DOM元素
const stageModal = document.getElementById('stage-modal');
const modalTitle = document.getElementById('modal-title');
const stageGrid = document.getElementById('stage-grid');
const closeModal = document.getElementById('close-modal');
const categoriesContainer = document.getElementById('categories-container');

// 初始化事件监听
document.addEventListener('DOMContentLoaded', function() {
    loadLevelsData();
    initModalEvents();
});

// 加载levels.json数据
async function loadLevelsData() {
    try {
        const response = await fetch('levels.json');
        levelsData = await response.json();
        renderCategoryCards();
    } catch (error) {
        console.error('加载levels.json失败:', error);
        // 如果加载失败，使用默认数据
        levelsData = {
            "主线剧情": {
                "picture": "kitchen.png",
                "required_health": 0,
                "stages": ["stage1", "stage2", "stage3", "stage4", "stage5"]
            },
            "关东豪飨": {
                "picture": "dongbei.jpg",
                "required_health": 200,
                "stages": ["dongbei1"]
            },
            "粤馔精工": {
                "picture": "yue.jpeg",
                "required_health": 400,
                "stages": []
            },
            "浙韵风雅": {
                "picture": "zhe.jpg",
                "required_health": 400,
                "stages": []
            }
        };
        renderCategoryCards();
    }
}

// 渲染分类卡片
function renderCategoryCards() {
    categoriesContainer.innerHTML = '';
    
    Object.keys(levelsData).forEach((categoryName, index) => {
        const categoryData = levelsData[categoryName];
        const card = createCategoryCard(categoryName, categoryData);
        
        // 添加加载动画
        card.style.opacity = '0';
        card.style.transform = 'translateY(50px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.6s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 200);
        
        categoriesContainer.appendChild(card);
    });
    
    // 预加载所有图片
    preloadCategoryImages();
}

// 创建分类卡片
function createCategoryCard(categoryName, categoryData) {
    const card = document.createElement('div');
    card.className = 'category-card';
    card.dataset.category = categoryName;
    card.dataset.picture = categoryData.picture;
    
    const background = document.createElement('div');
    background.className = 'category-background';
    
    const image = document.createElement('img');
    image.className = 'category-image';
    image.src = `assets/places/${categoryData.picture}`;
    image.alt = categoryName;
    
    const label = document.createElement('div');
    label.className = 'category-label';
    
    const title = document.createElement('h3');
    title.textContent = categoryName;
    
    label.appendChild(title);
    background.appendChild(image);
    card.appendChild(background);
    card.appendChild(label);
    
    // 添加事件监听
    card.addEventListener('click', function() {
        openStageModal(categoryName);
    });
    
    card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openStageModal(categoryName);
        }
    });
    
    card.setAttribute('tabindex', '0');
    
    return card;
}

// 初始化模态框事件
function initModalEvents() {
    // 关闭按钮
    closeModal.addEventListener('click', closeStageModal);
    
    // 点击模态框外部关闭
    stageModal.addEventListener('click', function(e) {
        if (e.target === stageModal) {
            closeStageModal();
        }
    });
    
    // ESC键关闭
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && stageModal.style.display === 'flex') {
            closeStageModal();
        }
    });
}

// 打开关卡选择模态框
function openStageModal(categoryName) {
    const categoryData = levelsData[categoryName];
    
    if (!categoryData) {
        console.error('找不到分类数据:', categoryName);
        return;
    }
    
    // 设置标题
    modalTitle.textContent = `${categoryName} - 选择关卡`;
    
    // 清空并生成关卡按钮
    stageGrid.innerHTML = '';
    
    if (!categoryData.stages || categoryData.stages.length === 0) {
        stageGrid.innerHTML = '<p style="grid-column: 1/-1; color: #666; font-size: 1.2rem;">暂无可用关卡</p>';
    } else {
        categoryData.stages.forEach((stage, index) => {
            const stageBtn = createStageButton(stage, index + 1);
            stageGrid.appendChild(stageBtn);
        });
    }
    
    // 显示模态框
    stageModal.style.display = 'flex';
    
    // 焦点管理
    setTimeout(() => {
        closeModal.focus();
    }, 100);
}

// 创建关卡按钮
function createStageButton(stageId, stageNumber) {
    const button = document.createElement('button');
    button.className = 'stage-btn';
    button.textContent = stageNumber;
    button.title = `第${stageNumber}关`;
    
    button.addEventListener('click', function() {
        startGame(stageId);
    });
    
    button.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            startGame(stageId);
        }
    });
    
    return button;
}

// 关闭关卡选择模态框
function closeStageModal() {
    stageModal.style.display = 'none';
}

// 开始游戏
function startGame(stageId) {
    window.location.href = `main_scene.html?stage=${stageId}`;
}

// 返回首页
function goBack() {
    window.location.href = 'start.html';
}

// 预加载分类图片
function preloadCategoryImages() {
    if (!levelsData) return;
    
    const images = [];
    Object.values(levelsData).forEach(categoryData => {
        if (categoryData.picture) {
            images.push(`assets/places/${categoryData.picture}`);
        }
    });
    
    images.forEach(src => {
        const img = new Image();
        img.src = src;
    });
}