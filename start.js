function startGame() {
    // 添加按钮点击动画效果
    const button = document.querySelector('.start-button');
    button.style.transform = 'scale(0.95)';
    button.style.transition = 'transform 0.1s ease';
    
    setTimeout(() => {
        button.style.transform = 'scale(1)';
        
        // 添加淡出效果
        document.body.style.transition = 'opacity 0.5s ease';
        document.body.style.opacity = '0';
        
        // 跳转到关卡选择页面
        setTimeout(() => {
            window.location.href = 'level_select.html';
        }, 500);
        
    }, 100);
}

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', function() {
    // 添加淡入效果
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.8s ease';
    
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
    
    // 添加键盘支持（按Enter键开始游戏）
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            startGame();
        }
    });
});

// 防止右键菜单（可选，增加复古感）
document.addEventListener('contextmenu', function(event) {
    event.preventDefault();
});

// 添加触摸设备支持
let touchStartTime = 0;
document.addEventListener('touchstart', function(event) {
    touchStartTime = Date.now();
});

document.addEventListener('touchend', function(event) {
    const touchDuration = Date.now() - touchStartTime;
    if (touchDuration < 500) { // 轻触
        const button = document.querySelector('.start-button');
        if (event.target === button || button.contains(event.target)) {
            event.preventDefault();
            startGame();
        }
    }
});