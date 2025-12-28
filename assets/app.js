/**
 * SempliCom - Main JavaScript
 */

(function() {
    'use strict';

    // DOM Elements
    const header = document.getElementById('header');
    const navToggle = document.getElementById('navToggle');
    const nav = document.getElementById('nav');
    const navLinks = document.querySelectorAll('.nav-link');
    const faqQuestions = document.querySelectorAll('.faq-question');
    const contactForm = document.getElementById('contactForm');
    const formSuccess = document.getElementById('formSuccess');
    const revealElements = document.querySelectorAll('.reveal');

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });

                // Close mobile nav if open
                if (nav.classList.contains('open')) {
                    closeMobileNav();
                }
            }
        });
    });

    // Header scroll effect
    function handleScroll() {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        // Update active nav link
        updateActiveNavLink();
    }

    // Update active navigation link based on scroll position
    function updateActiveNavLink() {
        const sections = document.querySelectorAll('section[id]');
        const scrollPos = window.scrollY + 100;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');

            if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }

    // Mobile navigation toggle
    function toggleMobileNav() {
        const isOpen = nav.classList.toggle('open');
        navToggle.setAttribute('aria-expanded', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
    }

    function closeMobileNav() {
        nav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    if (navToggle) {
        navToggle.addEventListener('click', toggleMobileNav);
    }

    // Close mobile nav when clicking outside
    document.addEventListener('click', (e) => {
        if (nav.classList.contains('open') &&
            !nav.contains(e.target) &&
            !navToggle.contains(e.target)) {
            closeMobileNav();
        }
    });


    // FAQ accordion
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const faqItem = question.parentElement;
            const isOpen = faqItem.classList.contains('open');

            // Close all others
            document.querySelectorAll('.faq-item.open').forEach(item => {
                if (item !== faqItem) {
                    item.classList.remove('open');
                    item.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
                }
            });

            // Toggle current
            faqItem.classList.toggle('open', !isOpen);
            question.setAttribute('aria-expanded', !isOpen);
        });
    });

    // Contact form handling
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Basic validation
            const name = contactForm.querySelector('#name');
            const email = contactForm.querySelector('#email');
            const message = contactForm.querySelector('#message');

            if (!name.value.trim() || !email.value.trim() || !message.value.trim()) {
                return;
            }

            // Simple email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.value)) {
                return;
            }

            // Show success message (no actual submission - static site)
            formSuccess.hidden = false;
            contactForm.reset();

            // Hide success after 5 seconds
            setTimeout(() => {
                formSuccess.hidden = true;
            }, 5000);
        });
    }

    // Reveal on scroll (Intersection Observer)
    function initRevealAnimations() {
        if (!('IntersectionObserver' in window)) {
            // Fallback for older browsers
            revealElements.forEach(el => el.classList.add('visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        revealElements.forEach(el => observer.observe(el));
    }

    // Update copyright year
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // Hero Carousel
    function initCarousel() {
        const carousel = document.querySelector('.hero-carousel');
        if (!carousel) return;

        const track = carousel.querySelector('.carousel-track');
        const slides = carousel.querySelectorAll('.carousel-slide');
        const dots = carousel.querySelectorAll('.carousel-dots .dot');

        if (slides.length === 0) return;

        let currentIndex = 0;
        const totalSlides = slides.length;
        const autoPlayInterval = 4000; // 4 secondi

        function goToSlide(index) {
            currentIndex = index;
            track.style.transform = `translateX(-${currentIndex * 100}%)`;

            // Update dots
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === currentIndex);
            });
        }

        function nextSlide() {
            const next = (currentIndex + 1) % totalSlides;
            goToSlide(next);
        }

        function prevSlide() {
            const prev = (currentIndex - 1 + totalSlides) % totalSlides;
            goToSlide(prev);
        }

        // Click on dots
        dots.forEach((dot, i) => {
            dot.addEventListener('click', () => goToSlide(i));
        });

        // Auto-play
        let autoPlay = setInterval(nextSlide, autoPlayInterval);

        function resetAutoPlay() {
            clearInterval(autoPlay);
            autoPlay = setInterval(nextSlide, autoPlayInterval);
        }

        // Pause on hover
        carousel.addEventListener('mouseenter', () => clearInterval(autoPlay));
        carousel.addEventListener('mouseleave', () => {
            autoPlay = setInterval(nextSlide, autoPlayInterval);
        });

        // Touch/Swipe support
        let touchStartX = 0;
        let touchEndX = 0;
        const minSwipeDistance = 50;

        carousel.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            clearInterval(autoPlay);
        }, { passive: true });

        carousel.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const swipeDistance = touchEndX - touchStartX;

            if (Math.abs(swipeDistance) > minSwipeDistance) {
                if (swipeDistance < 0) {
                    nextSlide(); // Swipe left = next
                } else {
                    prevSlide(); // Swipe right = prev
                }
            }
            resetAutoPlay();
        }, { passive: true });

        // Mouse drag support for desktop
        let isDragging = false;
        let dragStartX = 0;

        carousel.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragStartX = e.clientX;
            clearInterval(autoPlay);
            carousel.style.cursor = 'grabbing';
        });

        carousel.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
        });

        carousel.addEventListener('mouseup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            carousel.style.cursor = 'grab';

            const dragDistance = e.clientX - dragStartX;
            if (Math.abs(dragDistance) > minSwipeDistance) {
                if (dragDistance < 0) {
                    nextSlide();
                } else {
                    prevSlide();
                }
            }
            resetAutoPlay();
        });

        carousel.addEventListener('mouseleave', () => {
            if (isDragging) {
                isDragging = false;
                carousel.style.cursor = 'grab';
            }
        });

        // Set initial cursor style
        carousel.style.cursor = 'grab';
    }

    // Contact Modal
    function initContactModal() {
        const modal = document.getElementById('contactModal');
        const modalClose = document.getElementById('modalClose');
        const modalForm = document.getElementById('modalForm');
        const modalPlan = document.getElementById('modalPlan');
        const modalSuccess = document.getElementById('modalSuccess');
        const openButtons = document.querySelectorAll('.open-modal');

        if (!modal) return;

        // Open modal
        function openModal(plan = '') {
            modal.hidden = false;
            document.body.style.overflow = 'hidden';

            // Set plan if provided
            if (plan && modalPlan) {
                modalPlan.value = plan;
            }

            // Focus first input after animation
            setTimeout(() => {
                const firstInput = modalForm.querySelector('input, select');
                if (firstInput) firstInput.focus();
            }, 300);
        }

        // Close modal
        function closeModal() {
            modal.hidden = true;
            document.body.style.overflow = '';

            // Reset form after close animation
            setTimeout(() => {
                if (modalForm) modalForm.reset();
                if (modalSuccess) modalSuccess.hidden = true;

                // Show form again, hide success
                const formElements = modalForm.querySelectorAll('.form-group, .btn');
                formElements.forEach(el => el.style.display = '');
            }, 300);
        }

        // Button click handlers
        openButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const plan = btn.dataset.plan || '';
                openModal(plan);
            });
        });

        // Close button
        if (modalClose) {
            modalClose.addEventListener('click', closeModal);
        }

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.hidden) {
                closeModal();
            }
        });

        // Form submission
        if (modalForm) {
            modalForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                // Validate required fields
                const name = modalForm.querySelector('#modalName');
                const email = modalForm.querySelector('#modalEmail');
                const privacy = modalForm.querySelector('#modalPrivacy');

                if (!name.value.trim() || !email.value.trim()) {
                    return;
                }

                // Email validation
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email.value)) {
                    email.focus();
                    return;
                }

                // Privacy check
                if (!privacy.checked) {
                    privacy.focus();
                    return;
                }

                // Get submit button
                const submitBtn = modalForm.querySelector('button[type="submit"]');
                const btnText = submitBtn.querySelector('.btn-text');
                const btnLoading = submitBtn.querySelector('.btn-loading');

                // Show loading state
                if (btnText) btnText.hidden = true;
                if (btnLoading) btnLoading.hidden = false;
                submitBtn.disabled = true;

                // Collect form data
                const formData = new FormData(modalForm);
                const data = Object.fromEntries(formData.entries());

                // Invio email tramite Netlify Function
                try {
                    const response = await fetch('/.netlify/functions/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });

                    if (!response.ok) {
                        throw new Error('Errore invio email');
                    }

                    // Hide form fields, show success
                    const formElements = modalForm.querySelectorAll('.form-group, button[type="submit"]');
                    formElements.forEach(el => el.style.display = 'none');
                    modalSuccess.hidden = false;

                    // Close modal after delay
                    setTimeout(closeModal, 3000);

                } catch (error) {
                    console.error('Form submission error:', error);
                    alert('Si è verificato un errore. Riprova più tardi.');
                } finally {
                    // Reset button state
                    if (btnText) btnText.hidden = false;
                    if (btnLoading) btnLoading.hidden = true;
                    submitBtn.disabled = false;
                }
            });
        }
    }

    // Initialize
    function init() {
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Initial check
        initRevealAnimations();
        initCarousel();
        initContactModal();
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
