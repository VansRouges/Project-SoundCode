function classToggle() {
    let el = document.querySelector('.icon-cards__content');
    el.classList.toggle('step-animation');
  }

  document.querySelector('#toggle-animation').addEventListener('click', classToggle);
