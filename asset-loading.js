(function () {
    'use strict';

    // Keep the existing page structure and interactions, but lower the cost of
    // content that is below the first viewport. Images are still loaded when
    // the browser needs them, so links and page behavior remain unchanged.
    function markImagesLazy(root) {
        const scope = root && root.querySelectorAll ? root : document;
        if (root && root.nodeType === 1 && root.matches('img:not([loading])')) {
            root.loading = 'lazy';
            root.decoding = 'async';
        }
        scope.querySelectorAll('img:not([loading])').forEach(function (image) {
            image.loading = 'lazy';
            image.decoding = 'async';
        });
    }

    function observeDynamicImages() {
        if (!window.MutationObserver) return;
        const observer = new MutationObserver(function (records) {
            records.forEach(function (record) {
                record.addedNodes.forEach(function (node) {
                    if (node.nodeType === 1) markImagesLazy(node);
                });
            });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    markImagesLazy();
    observeDynamicImages();
})();
