document.documentElement.classList.add("has-logo-loader");
document.body.classList.add("is-loading");

window.addEventListener("load", () => {
    const loader = document.getElementById("logoLoader");
    if(!loader) return;

    window.setTimeout(() => {
        loader.classList.add("hide");
        document.body.classList.remove("is-loading");
    }, 2200);

    window.setTimeout(() => {
        loader.remove();
    }, 3600);
});
