(function () {
    'use strict';

    function markCurrentPage() {
        if (!document.body) return;
        const fileName = decodeURIComponent(location.pathname.split('/').pop() || 'index.html');
        const pageClasses = {
            'index.html': 'page-home',
            '加载页面.html': 'page-loading',
            '操作指南.html': 'page-guide',
            '抽卡页面.html': 'page-cards',
            '游戏地图页面.html': 'page-game-map',
            '数据可视页面.html': 'page-data',
            '古建筑泛介绍.html': 'page-gene',
            '地图点位.html': 'page-points',
            '古今对比.html': 'page-compare',
            '周边文创.html': 'page-products'
        };
        document.body.classList.add(pageClasses[fileName] || 'page-generic');
    }

    function enhanceMobileNavigation() {
        document.querySelectorAll('.nav-container').forEach(function (container, index) {
            const menu = container.querySelector(':scope > .nav-menu');
            if (!menu || container.querySelector(':scope > .mobile-nav-toggle')) return;

            const menuId = menu.id || `mobile-nav-menu-${index + 1}`;
            menu.id = menuId;

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'mobile-nav-toggle';
            button.setAttribute('aria-controls', menuId);
            button.setAttribute('aria-expanded', 'false');
            button.setAttribute('aria-label', '打开网站导航');
            button.innerHTML = '<span></span><span></span><span></span>';
            container.insertBefore(button, menu);

            const closeMenu = function () {
                container.classList.remove('mobile-nav-open');
                button.setAttribute('aria-expanded', 'false');
                button.setAttribute('aria-label', '打开网站导航');
            };

            button.addEventListener('click', function () {
                const willOpen = !container.classList.contains('mobile-nav-open');
                document.querySelectorAll('.nav-container.mobile-nav-open').forEach(function (openContainer) {
                    openContainer.classList.remove('mobile-nav-open');
                    const openButton = openContainer.querySelector(':scope > .mobile-nav-toggle');
                    if (openButton) openButton.setAttribute('aria-expanded', 'false');
                });
                container.classList.toggle('mobile-nav-open', willOpen);
                button.setAttribute('aria-expanded', String(willOpen));
                button.setAttribute('aria-label', willOpen ? '关闭网站导航' : '打开网站导航');
            });

            menu.addEventListener('click', function (event) {
                if (event.target.closest('a')) closeMenu();
            });

            document.addEventListener('click', function (event) {
                if (!container.contains(event.target)) closeMenu();
            });

            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') closeMenu();
            });
        });
    }

    function refreshResponsiveWidgets() {
        window.dispatchEvent(new Event('resize'));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            markCurrentPage();
            enhanceMobileNavigation();
        });
    } else {
        markCurrentPage();
        enhanceMobileNavigation();
    }

    window.addEventListener('orientationchange', function () {
        setTimeout(refreshResponsiveWidgets, 250);
    });
    window.addEventListener('load', function () {
        if (window.matchMedia('(max-width: 768px)').matches) {
            setTimeout(refreshResponsiveWidgets, 120);
        }
    });
})();
