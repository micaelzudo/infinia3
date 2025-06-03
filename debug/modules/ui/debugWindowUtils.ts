/**
 * Makes a given HTML element draggable using a specified handle element.
 * @param logWindow The HTMLElement to make draggable.
 * @param dragHandle The HTMLElement that will act as the drag handle.
 */
export function makeLogWindowDraggable(logWindow: HTMLElement, dragHandle: HTMLElement): void {
    let offsetX: number, offsetY: number;
    let isDragging = false;

    dragHandle.onmousedown = (e: MouseEvent) => {
        isDragging = true;
        offsetX = e.clientX - logWindow.offsetLeft;
        offsetY = e.clientY - logWindow.offsetTop;
        document.onmousemove = onMouseMove;
        document.onmouseup = onMouseUp;
        dragHandle.style.cursor = 'grabbing';
    };

    function onMouseMove(e: MouseEvent): void {
        if (!isDragging) return;
        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;

        // Boundary checks (optional, to keep window on screen)
        const maxLeft = window.innerWidth - logWindow.offsetWidth;
        const maxTop = window.innerHeight - logWindow.offsetHeight;
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));

        logWindow.style.left = newLeft + 'px';
        logWindow.style.top = newTop + 'px';
    }

    function onMouseUp(): void {
        isDragging = false;
        document.onmousemove = null;
        document.onmouseup = null;
        dragHandle.style.cursor = 'move';
    }
}

/**
 * Makes a given HTML element resizable using a specified handle element.
 * @param logWindow The HTMLElement to make resizable.
 * @param resizeHandle The HTMLElement that will act as the resize handle.
 */
export function makeLogWindowResizable(logWindow: HTMLElement, resizeHandle: HTMLElement): void {
    let startX: number, startY: number, startWidth: number, startHeight: number;
    let isResizing = false;

    resizeHandle.onmousedown = (e: MouseEvent) => {
        e.preventDefault(); // Prevent default drag behavior
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView!.getComputedStyle(logWindow).width, 10);
        startHeight = parseInt(document.defaultView!.getComputedStyle(logWindow).height, 10);
        document.onmousemove = onResizeMouseMove;
        document.onmouseup = onResizeMouseUp;
    };

    function onResizeMouseMove(e: MouseEvent): void {
        if (!isResizing) return;
        const newWidth = startWidth + (e.clientX - startX);
        const newHeight = startHeight + (e.clientY - startY);
        logWindow.style.width = Math.max(200, newWidth) + 'px'; // Min width 200px
        logWindow.style.height = Math.max(100, newHeight) + 'px'; // Min height 100px
    }

    function onResizeMouseUp(): void {
        isResizing = false;
        document.onmousemove = null;
        document.onmouseup = null;
    }
} 