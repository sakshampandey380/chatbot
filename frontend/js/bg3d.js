/**
 * PolyChat 3D - Interactive 3D Flying Background, Page Transitions & 3D Tilt Engine
 */
(function () {
    "use strict";

    // 1. Inject 3D Ambient Orbs + 3D Canvas Layer into every page
    function createBackgroundStage() {
        if (document.getElementById("polychat3d-stage")) return;

        const stage = document.createElement("div");
        stage.id = "polychat3d-stage";
        stage.className = "bg-3d-stage";
        stage.setAttribute("aria-hidden", "true");
        stage.innerHTML = `
            <div class="bg-aurora-orb orb-1"></div>
            <div class="bg-aurora-orb orb-2"></div>
            <div class="bg-aurora-orb orb-3"></div>
            <div class="bg-aurora-orb orb-4"></div>
            <div class="bg-grid-plane"></div>
            <canvas id="polychat3d-canvas"></canvas>
        `;
        document.body.prepend(stage);

        initCanvas3D(stage.querySelector("#polychat3d-canvas"));
    }

    // 2. 60fps 3D Flying Shapes & Color-Shifting Particles Canvas
    function initCanvas3D(canvas) {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        let mouseX = width / 2;
        let mouseY = height / 2;
        let targetMouseX = width / 2;
        let targetMouseY = height / 2;
        let globalHue = 225;

        window.addEventListener("resize", () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });

        window.addEventListener("pointermove", (e) => {
            targetMouseX = e.clientX;
            targetMouseY = e.clientY;
        }, { passive: true });

        const isMobile = window.innerWidth < 768;
        const shapeCount = isMobile ? 16 : 30;
        const shapes = [];
        const types = ["cube", "octa", "ring", "orb", "star", "prism"];

        for (let i = 0; i < shapeCount; i++) {
            shapes.push(createShape(width, height, types[i % types.length]));
        }

        function createShape(w, h, type) {
            return {
                type,
                x: (Math.random() - 0.5) * w * 1.4,
                y: (Math.random() - 0.5) * h * 1.4,
                z: Math.random() * 850 + 120,
                vx: (Math.random() - 0.5) * 0.55,
                vy: (Math.random() - 0.5) * 0.55 - 0.18,
                vz: -(Math.random() * 0.85 + 0.25),
                rx: Math.random() * Math.PI * 2,
                ry: Math.random() * Math.PI * 2,
                rz: Math.random() * Math.PI * 2,
                vrx: (Math.random() - 0.5) * 0.016,
                vry: (Math.random() - 0.5) * 0.016,
                vrz: (Math.random() - 0.5) * 0.012,
                size: Math.random() * 24 + 16,
                hueOffset: Math.random() * 160,
            };
        }

        function rotate3D(pt, rx, ry, rz) {
            let [x, y, z] = pt;
            // Rotate X
            let cosX = Math.cos(rx), sinX = Math.sin(rx);
            let y1 = y * cosX - z * sinX;
            let z1 = y * sinX + z * cosX;
            // Rotate Y
            let cosY = Math.cos(ry), sinY = Math.sin(ry);
            let x2 = x * cosY + z1 * sinY;
            let z2 = -x * sinY + z1 * cosY;
            // Rotate Z
            let cosZ = Math.cos(rz), sinZ = Math.sin(rz);
            let x3 = x2 * cosZ - y1 * sinZ;
            let y3 = x2 * sinZ + y1 * cosZ;
            return [x3, y3, z2];
        }

        const CUBE_VERTS = [
            [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
            [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
        ];
        const CUBE_EDGES = [
            [0, 1], [1, 2], [2, 3], [3, 0],
            [4, 5], [5, 6], [6, 7], [7, 4],
            [0, 4], [1, 5], [2, 6], [3, 7],
        ];

        const OCTA_VERTS = [
            [0, -1.3, 0], [0, 1.3, 0],
            [-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1],
        ];
        const OCTA_EDGES = [
            [0, 2], [0, 3], [0, 4], [0, 5],
            [1, 2], [1, 3], [1, 4], [1, 5],
            [2, 3], [3, 4], [4, 5], [5, 2],
        ];

        const PRISM_VERTS = [
            [0, -1.2, -0.8], [-1.1, 0.9, -0.8], [1.1, 0.9, -0.8],
            [0, -1.2, 0.8], [-1.1, 0.9, 0.8], [1.1, 0.9, 0.8],
        ];
        const PRISM_EDGES = [
            [0, 1], [1, 2], [2, 0],
            [3, 4], [4, 5], [5, 3],
            [0, 3], [1, 4], [2, 5],
        ];

        function animate() {
            ctx.clearRect(0, 0, width, height);
            globalHue = (globalHue + 0.22) % 360;

            mouseX += (targetMouseX - mouseX) * 0.05;
            mouseY += (targetMouseY - mouseY) * 0.05;

            const parallaxX = (mouseX - width / 2) * 0.06;
            const parallaxY = (mouseY - height / 2) * 0.06;
            const fov = 520;
            const projectedCenters = [];

            for (let i = 0; i < shapes.length; i++) {
                const s = shapes[i];
                s.x += s.vx;
                s.y += s.vy;
                s.z += s.vz;
                s.rx += s.vrx;
                s.ry += s.vry;
                s.rz += s.vrz;

                if (s.z < 80 || s.z > 980 || Math.abs(s.x) > width * 0.95 || Math.abs(s.y) > height * 0.95) {
                    s.x = (Math.random() - 0.5) * width * 1.3;
                    s.y = (Math.random() - 0.5) * height * 1.3;
                    s.z = 920;
                }

                const scale = fov / (fov + s.z);
                const sx = width / 2 + (s.x - parallaxX) * scale;
                const sy = height / 2 + (s.y - parallaxY) * scale;
                const r = s.size * scale;
                const hue = (globalHue + s.hueOffset) % 360;
                const alpha = Math.min(0.62, Math.max(0.12, (1 - s.z / 1000) * 0.68));

                projectedCenters.push({ x: sx, y: sy, hue, alpha, z: s.z });

                ctx.save();
                ctx.strokeStyle = `hsla(${hue}, 82%, 58%, ${alpha})`;
                ctx.fillStyle = `hsla(${hue}, 88%, 66%, ${alpha * 0.28})`;
                ctx.lineWidth = Math.max(1, 2.1 * scale);

                if (s.type === "cube" || s.type === "octa" || s.type === "prism") {
                    const verts = s.type === "cube" ? CUBE_VERTS : s.type === "octa" ? OCTA_VERTS : PRISM_VERTS;
                    const edges = s.type === "cube" ? CUBE_EDGES : s.type === "octa" ? OCTA_EDGES : PRISM_EDGES;
                    const pts = verts.map((v) => {
                        const [rx, ry, rz] = rotate3D(v, s.rx, s.ry, s.rz);
                        const pScale = fov / (fov + s.z + rz * s.size);
                        return [
                            width / 2 + (s.x - parallaxX + rx * s.size) * pScale,
                            height / 2 + (s.y - parallaxY + ry * s.size) * pScale,
                        ];
                    });

                    ctx.beginPath();
                    for (let e = 0; e < edges.length; e++) {
                        const [a, b] = edges[e];
                        ctx.moveTo(pts[a][0], pts[a][1]);
                        ctx.lineTo(pts[b][0], pts[b][1]);
                    }
                    ctx.stroke();

                    // Vertex glow dots
                    for (let v = 0; v < pts.length; v++) {
                        ctx.beginPath();
                        ctx.arc(pts[v][0], pts[v][1], Math.max(1.4, 2.6 * scale), 0, Math.PI * 2);
                        ctx.fill();
                    }
                } else if (s.type === "ring") {
                    ctx.translate(sx, sy);
                    ctx.rotate(s.rz);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, r * 1.35, r * 0.55, s.rx * 0.5, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
                    ctx.fill();
                } else if (s.type === "star") {
                    ctx.translate(sx, sy);
                    ctx.rotate(s.rz);
                    ctx.beginPath();
                    for (let p = 0; p < 8; p++) {
                        const radius = p % 2 === 0 ? r * 1.1 : r * 0.42;
                        const angle = (p * Math.PI) / 4;
                        if (p === 0) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
                        else ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                } else {
                    // 3D Glowing Orb
                    const grad = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, r * 0.1, sx, sy, r * 1.2);
                    grad.addColorStop(0, `hsla(${hue}, 95%, 85%, ${alpha * 0.9})`);
                    grad.addColorStop(0.5, `hsla(${(hue + 35) % 360}, 85%, 65%, ${alpha * 0.45})`);
                    grad.addColorStop(1, `hsla(${hue}, 85%, 60%, 0)`);
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(sx, sy, r * 1.2, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }

            // Connect nearby 3D nodes with delicate glowing lines
            for (let i = 0; i < projectedCenters.length; i++) {
                for (let j = i + 1; j < projectedCenters.length; j++) {
                    const a = projectedCenters[i];
                    const b = projectedCenters[j];
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist < 155) {
                        const lineAlpha = (1 - dist / 155) * 0.16;
                        ctx.strokeStyle = `hsla(${(a.hue + b.hue) / 2}, 80%, 60%, ${lineAlpha})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
            }

            requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);
    }

    // 3. 3D Interactive Card Tilt Effect on desktop pointer move
    function init3DTiltCards() {
        if (window.matchMedia("(pointer: coarse)").matches) return;

        const selectors = ".auth-hero, .auth-panel, .feature-card, .profile-card, .profile-form-panel";
        document.querySelectorAll(selectors).forEach((card) => {
            card.addEventListener("pointermove", (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const maxDeg = card.classList.contains("feature-card") ? 6 : 2.2;
                const rotateX = ((y - centerY) / centerY) * -maxDeg;
                const rotateY = ((x - centerX) / centerX) * maxDeg;

                card.style.transform = `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(4px)`;
            });

            card.addEventListener("pointerleave", () => {
                card.style.transform = "";
            });
        });
    }

    // 4. Smooth 3D Page Open & Close Transition Helper
    function initPageTransitions() {
        document.body.classList.add("page-3d-enter");
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.body.classList.add("page-3d-ready");
            });
        });

        // Intercept internal page links for smooth 3D exit animation
        document.addEventListener("click", (e) => {
            const link = e.target.closest("a[href]");
            if (!link) return;
            const href = link.getAttribute("href");
            if (!href || href.startsWith("#") || href.startsWith("http") || link.target === "_blank") return;
            e.preventDefault();
            navigateWith3DTransition(href);
        });
    }

    function navigateWith3DTransition(url) {
        document.body.classList.remove("page-3d-ready");
        document.body.classList.add("page-3d-exit");
        setTimeout(() => {
            window.location.href = url;
        }, 280);
    }

    window.PolyChat3D = {
        navigate: navigateWith3DTransition,
        refreshTilt: init3DTiltCards,
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            createBackgroundStage();
            initPageTransitions();
            init3DTiltCards();
        });
    } else {
        createBackgroundStage();
        initPageTransitions();
        init3DTiltCards();
    }
})();
