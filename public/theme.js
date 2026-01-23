// Theme Toggle Logic
document.addEventListener('DOMContentLoaded', () => {
    // 1. Create and inject the toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'theme-toggle';
    toggleBtn.innerHTML = '🌓'; // Default icon
    toggleBtn.title = 'สลับโหมดมืด/สว่าง';
    toggleBtn.setAttribute('aria-label', 'Toggle Dark Mode');
    document.body.appendChild(toggleBtn);

    // 2. Function to update icon
    const updateIcon = (isDark) => {
        toggleBtn.innerHTML = isDark ? '☀️' : '🌙';
    };

    // 3. Check saved preference or system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    let isDark = savedTheme === 'dark' || (!savedTheme && systemPrefersDark);

    // 4. Apply initial theme
    if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateIcon(true);
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        updateIcon(false);
    }

    // 5. Toggle Event Listener
    toggleBtn.addEventListener('click', () => {
        isDark = !isDark;
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
        updateIcon(isDark);
        
        // Add a cool sparkle effect on click
        createSparkle(toggleBtn);
    });

    // Fun sparkle effect function
    function createSparkle(element) {
        const rect = element.getBoundingClientRect();
        for (let i = 0; i < 5; i++) {
            const sparkle = document.createElement('div');
            sparkle.style.cssText = `
                position: fixed;
                left: ${rect.left + rect.width/2}px;
                top: ${rect.top + rect.height/2}px;
                width: 5px;
                height: 5px;
                background: white;
                border-radius: 50%;
                pointer-events: none;
                animation: explode 0.5s ease-out forwards;
                z-index: 10000;
            `;
            
            // Random direction
            const angle = Math.random() * Math.PI * 2;
            const velocity = 30 + Math.random() * 30;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;
            
            sparkle.animate([
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
            ], {
                duration: 500,
                easing: 'ease-out'
            }).onfinish = () => sparkle.remove();
            
            document.body.appendChild(sparkle);
        }
    }

    // 6. Inject ASCII Art Background
    const asciiArt = `
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣤⣤⣤⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ 
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣾⣿⣿⡿⠿⣿⣷⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ 
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢰⣿⣿⣿⠋⢀⣠⣾⣿⣷⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ 
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⡿⣡⣾⣿⣿⣿⣿⠟⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ 
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣰⣿⣷⠿⠟⠛⠛⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ 
⠀⠀⠀⠀⢀⣠⣤⣶⣶⣦⣤⡀⢿⣿⡿⣿⣥⣤⣂⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ 
⠀⠀⣠⣶⣿⣿⣿⠟⠛⠛⣻⣿⣿⣏⠁⠀⠹⣿⣿⣿⣷⣦⣄⠀⠀⠀⠀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ 
⠀⠀⠻⣿⣿⠟⠁⢀⣠⣾⣿⡿⣿⣿⣄⠀⠀⠉⠙⠛⠿⠿⠿⠟⠙⠹⠿⠿⠿⢿⣿⣿⣿⣶⣄⠀⠀⠀ 
⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⡟⠀⣿⣿⣿⣷⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⢿⣿⣿⣧⠀⠀ 
⠀⠀⠀⠀⢻⣿⣿⣿⣿⠟⠁⠀⢸⣿⡿⠛⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⡀⠀ 
⠀⠀⠀⠀⠀⠉⠚⠋⠀⠀⢀⣠⣾⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣷⠀ 
⠀⠀⢀⣠⣴⣶⣶⣶⣿⣿⣿⣿⡿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⣿⡟⠋⠓ 
⠀⣴⣿⠇⠉⠉⠛⠛⠙⠛⠛⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠁⠃⠀⠀ 
⣴⣿⣿⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ 
⢻⣿⣿⣷⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ 
⠀⠳⡏⠋⠉⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
`;

    const artContainer = document.createElement('div');
    artContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        white-space: pre;
        font-family: monospace;
        font-size: 14px; /* Default size */
        line-height: 1.2;
        color: #FF1493; /* Deep Pink */
        opacity: 0.15; /* Slightly more visible */
        z-index: 9998; /* High z-index but below modal/toggle */
        pointer-events: none; /* Crucial: clicks pass through */
        filter: blur(1px); /* Less blur to be cleaner */
        mix-blend-mode: overlay; /* Allows it to blend through UI elements */
        user-select: none;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    `;
    
    // Create a wrapper to scale the art to fit screen better
    const content = document.createElement('div');
    content.textContent = asciiArt;
    content.style.transform = 'scale(3)'; // Make it bigger
    
    artContainer.appendChild(content);
    document.body.appendChild(artContainer);
});
