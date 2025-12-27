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
    const pricingToggle = document.getElementById('pricingToggle');
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

    // Pricing toggle (monthly/yearly)
    if (pricingToggle) {
        let isYearly = false;

        pricingToggle.addEventListener('click', () => {
            isYearly = !isYearly;
            pricingToggle.classList.toggle('active', isYearly);

            // Update toggle labels
            document.querySelectorAll('.toggle-label').forEach(label => {
                const period = label.dataset.period;
                label.classList.toggle('active',
                    (period === 'yearly' && isYearly) ||
                    (period === 'monthly' && !isYearly)
                );
            });

            // Update prices
            document.querySelectorAll('.price-amount').forEach(price => {
                const monthly = price.dataset.monthly;
                const yearly = price.dataset.yearly;
                price.textContent = isYearly ? yearly : monthly;
            });
        });

        // Set initial state
        document.querySelector('.toggle-label[data-period="monthly"]').classList.add('active');
    }

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

    // Initialize
    function init() {
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Initial check
        initRevealAnimations();
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
