class ActivitySelectButton {
    element: HTMLElement;
    constructor(activity: Activity) {
        this.element = document.createElement('li');

        this.element.className = 'popup-item';
        if (activity.id === App.activity?.id)
            this.element.classList.add('selected')

        this.element.innerText = activity.name.split(' - Rerun')[0];
        this.element.setAttribute('data', activity.id);
        this.element.setAttribute('onclick', 'UI.showLevels(this)');
    }
}
