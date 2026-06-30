document.addEventListener("DOMContentLoaded", () => {

    const observeElements = () => {

        const elements = document.querySelectorAll(".reveal:not(.observed)");

        const observer = new IntersectionObserver(entries => {

            entries.forEach(entry => {

                if(entry.isIntersecting) {

                    entry.target.classList.add("show");

                    observer.unobserve(entry.target);

                }

            });

        }, {

            threshold:0.12

        });

        elements.forEach(element => {

            element.classList.add("observed");

            observer.observe(element);

        });

    };

    observeElements();

    setTimeout(observeElements, 600);

    setTimeout(observeElements, 1200);

    document.addEventListener("matches:updated", observeElements);

});