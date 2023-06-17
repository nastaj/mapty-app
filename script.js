'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration, condition) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
    this.condition = condition; // {text, icon}
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()} in ${this.location.city}, ${
      this.location.country
    }`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence, location, condition) {
    super(coords, distance, duration, condition);
    this.cadence = cadence;
    this.location = location;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }

  // Needed for edit functionality
  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain, location, condition) {
    super(coords, distance, duration, condition);
    this.elevationGain = elevationGain;
    this.location = location;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycling1 = new Cycling([39, -12], 27, 95, 523);
// console.log(run1, cycling1);

/////////////////////////////////
// APPLICATION ARCHITECTURE

// Elements
const sidebar = document.querySelector('.sidebar');
const popup = document.querySelector('.popup');
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const btnOpenFunctions = document.querySelector('.btn-hamburger');
const functionsBoxEl = document.querySelector('.form__functions__box');
const deleteWorkouts = document.querySelector('.btn__delete__workouts');
const btnOverview = document.querySelector('.btn__overview');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = [];
  #distances = [];

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._eventTarget.bind(this));
    btnOpenFunctions.addEventListener('click', this._toggleModal);
    deleteWorkouts.addEventListener(
      'click',
      this._deleteAllWorkouts.bind(this)
    );
    btnOverview.addEventListener('click', this.__zoomOverview.bind(this));
  }

  _getPosition() {
    // If the API exists in the browser
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
    }
  }

  _loadMap(position) {
    const { latitude, longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    // Rendering markers from local storage
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    (async () => {
      try {
        const responseGeocode = await fetch(
          `https://api-bdc.net/data/reverse-geocode?latitude=${lat}&longitude=${lng}&localityLanguage=en&key=bdc_ba6d6b2a0f8e41ea9a428e365d0f7496`
        );
        const responseWeather = await fetch(
          `http://api.weatherapi.com/v1/current.json?key=896a929737f44360bf6115704231706&q=${lat},${lng}`
        );

        const weather = await responseWeather.json();
        const condition = weather.current.condition;

        const coords = await responseGeocode.json();
        const location = { city: coords.city, country: coords.countryName };

        // If workout running, create running object
        if (type === 'running') {
          const cadence = +inputCadence.value;
          // Check if data is valid
          if (
            !validInputs(distance, duration, cadence) ||
            !allPositive(distance, duration, cadence)
          )
            return alert('Inputs have to be positive numbers!');

          workout = new Running(
            [lat, lng],
            distance,
            duration,
            cadence,
            location,
            condition
          );
        }

        // If workout cycling, create cycling object
        if (type === 'cycling') {
          const elevation = +inputElevation.value;
          // Check if data is valid
          if (
            !validInputs(distance, duration, elevation) ||
            !allPositive(distance, duration)
          )
            return alert('Inputs have to be positive numbers!');

          workout = new Cycling(
            [lat, lng],
            distance,
            duration,
            elevation,
            location,
            condition
          );
        }

        // Add new object to workout array
        this.#workouts.push(workout);

        // Render workout on map as marker
        this._renderWorkoutMarker(workout);

        // Render workout on list
        this._renderWorkout(workout);

        // Hide form + Clear input fields
        this._hideForm();

        // Set local storage to all workouts
        this._setLocalStorage();

        // Show and hide success popup
        this._showPopup();

        setTimeout(() => {
          this._hidePopup();
        }, 5000);
      } catch (err) {
        console.log(err);
      }
    })();
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 200,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴'} ${workout.description} (${
          workout.condition.text
        })`
      )
      .openPopup();

    this.#markers.push(marker);
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <h2 class="workout__title">${workout.description}</h2>
      <div class="workout__functions">
            <button class="btn">
              <i class="ph-fill ph-pencil-simple btnEdit"></i>
            </button>
            <button class="btn">
              <i class="ph-fill ph-trash-simple btnDel"></i>
            </button>
          </div>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
        <div class="workout__details">
          <img class="condition__icon" src="${workout.condition.icon}">
        </div>
       </li>
       `;

    if (workout.type === 'cycling')
      html += `
       <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
        <div class="workout__details">
          <img class="condition__icon" src="${workout.condition.icon}">
        </div>
      </li>
      `;

    form.insertAdjacentHTML('afterend', html);
  }

  _eventTarget(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    if (e.target.classList.contains('btnDel'))
      this._deleteWorkout(workout, workoutEl);
    if (e.target.classList.contains('btnEdit')) this._editWorkout(e, workout);

    this._moveToPopup(e, workout, workoutEl);
  }

  _deleteWorkout(workout, workoutEl) {
    // Remove workout from workouts array
    this.#workouts.splice(this.#workouts.indexOf(workout), 1);

    // Remove workout from list
    workoutEl.remove();

    // Remove marker from map
    L.marker(workout.coords).remove();

    // Update local storage & refresh the page
    this._setLocalStorage();
    location.reload();
  }

  _deleteAllWorkouts() {
    // Clear workouts array
    this.#workouts = [];

    // Clear list
    containerWorkouts.innerHTML = '';

    // Reset local storage
    localStorage.removeItem('workouts');

    // Reload page
    location.reload();
  }

  _editWorkout(e, workout) {
    // Display edit form
    const workoutEl = e.target.closest('.workout');
    this._renderEditForm(workoutEl);

    // Type elements
    const editType = document.querySelector('.form__input--type--edit');
    const editCadence = document.querySelector('.form__input--cadence--edit');
    const editElevation = document.querySelector(
      '.form__input--elevation--edit'
    );

    editType.addEventListener('change', () => {
      editElevation.closest('.form__row').classList.toggle('form__row--hidden');
      editCadence.closest('.form__row').classList.toggle('form__row--hidden');
    });

    // Submit edit form
    const form = document.querySelector('.form-edit');
    form.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        this._submitEdit(e, workout, editType, editCadence, editElevation);
      }
    });
  }

  _submitEdit(e, workout, editType, editCadence, editElevation) {
    e.preventDefault();

    // Check functions
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    // Edit Form Elements
    const editDistance = document.querySelector('.form__input--distance--edit');
    const editDuration = document.querySelector('.form__input--duration--edit');

    // Get data from form
    const type = editType.value;
    const distance = +editDistance.value;
    const duration = +editDuration.value;

    // If workout running, modify corresponding running object
    if (type === 'running') {
      const cadence = +editCadence.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');

      // Edit workout values
      workout.type = type;
      workout.distance = distance;
      workout.duration = duration;
      workout.cadence = cadence;

      // Update pace
      workout.calcPace();
    }

    // If workout cycling, modify corresponding cycling object
    if (type === 'cycling') {
      const elevation = +editElevation.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');

      // Edit workout values
      workout.type = type;
      workout.distance = distance;
      workout.duration = duration;
      workout.elevationGain = elevation;

      // Update speed
      workout.calcSpeed();
    }

    // Update description
    workout._setDescription();

    // Set local storage to all workouts
    this._setLocalStorage();

    // Reload page to see changes
    location.reload();
  }

  _renderEditForm(workoutEl) {
    const html = `<form class="form-edit" data-id="${workoutEl.dataset.id}">
    <div class="form__row">
      <label class="form__label">Type</label>
      <select class="form__input form__input--type--edit">
        <option value="running">Running</option>
        <option value="cycling">Cycling</option>
      </select>
    </div>
    <div class="form__row">
      <label class="form__label">Distance</label>
      <input
        class="form__input form__input--distance--edit"
        placeholder="km"
      />
    </div>
    <div class="form__row">
      <label class="form__label">Duration</label>
      <input
        class="form__input form__input--duration--edit"
        placeholder="min"
      />
    </div>
    <div class="form__row">
      <label class="form__label">Cadence</label>
      <input
        class="form__input form__input--cadence--edit"
        placeholder="step/min"
      />
    </div>
    <div class="form__row form__row--hidden">
      <label class="form__label">Elev Gain</label>
      <input
        class="form__input form__input--elevation--edit"
        placeholder="meters"
      />
    </div>
    <i class="ph ph-x btnClose"></i>
    <button class="form__btn">OK</button>
  </form>`;

    form.insertAdjacentHTML('afterend', html);

    // Close form
    const btnClose = document.querySelector('.btnClose');
    btnClose.addEventListener('click', e => this._closeForm(e));
  }

  _closeForm(e) {
    const formEl = e.target.closest('form');
    formEl.remove();
  }

  _toggleModal() {
    functionsBoxEl.classList.toggle('hidden');
  }

  _moveToPopup(e, workout, workoutEl) {
    // Guard clause to prevent the error after removing a marker from the map in _deleteWorkout function
    if (!workout || !workoutEl) return;

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  __zoomOverview() {
    if (this.#markers.length === 0) return;

    const markers = new L.featureGroup(this.#markers);
    this.#map.fitBounds(markers.getBounds().pad(0.5));

    functionsBoxEl.classList.add('hidden');
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    const dataMarkers = JSON.parse(localStorage.getItem('markers'));

    if (!data && !dataMarkers) return;

    // Rebuilding prototype chain
    data.forEach(workout => {
      workout.type === 'running'
        ? (workout.__proto__ = Running.prototype)
        : (workout.__proto__ = Cycling.prototype);
    });

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  _showPopup() {
    popup.classList.remove('hidden');
  }

  _hidePopup() {
    popup.classList.add('hidden');
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  _sortByDistance() {
    // Sort the #workouts array by distance
    const sortedWorkouts = this.#workouts.sort(
      (a, b) => b.distance - a.distance
    );

    // Clear list
    const workoutsDOM = document.querySelectorAll('.workout');
    workoutsDOM.forEach(element => {
      element.parentNode.removeChild(element);
    });

    // Render workouts in new order
    sortedWorkouts.forEach(workout => {
      this._renderWorkout(workout);
    });
  }

  _sortByDuration() {
    // Sort the #workouts array by distance (ascending)
    const sortedWorkouts = this.#workouts.sort(
      (a, b) => b.duration - a.duration
    );

    // Clear list
    const workoutsDOM = document.querySelectorAll('.workout');
    workoutsDOM.forEach(element => {
      element.parentNode.removeChild(element);
    });

    // Render workouts in new order
    sortedWorkouts.forEach(workout => {
      this._renderWorkout(workout);
    });
  }
}

const app = new App();
