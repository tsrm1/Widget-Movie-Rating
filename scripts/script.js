(() => {
  const API_KEY = "5dd58b01";
  const $ = (s) => document.querySelector(s);

  const grid = $("#grid");
  const modal = $("#modal");
  const favCount = $("#favCount");
  const sortSelect = $("#sortSelect");
  const paginationContainer = $("#paginationContainer");
  const loadMoreBtn = $("#loadMoreBtn");
  const progressText = $("#progressText");
  const progressBar = $("#progressBar");
  const searchInput = $("#searchInput");

  const loader = document.createElement("div");
  loader.className = "loader";

  let state = {
    tab: "recent",
    movies: [],
    favorites: JSON.parse(localStorage.getItem("favorites") || "[]"),
    cache: JSON.parse(localStorage.getItem("movieCache") || "{}"),
    currentQuery: "",
    currentPage: 1,
    totalResults: 0,
  };

  function showLoader(fullClear = true) {
    if (fullClear) grid.innerHTML = "";
    grid.appendChild(loader);
    loader.style.display = "block";
  }

  function hideLoader() {
    loader.style.display = "none";
  }

  function safeSave(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      if (e.name === "QuotaExceededError") {
        localStorage.removeItem("movieCache");
        state.cache = {};
        localStorage.setItem(key, JSON.stringify(value));
      }
    }
  }

  async function getMovie(id) {
    if (state.cache[id]) return state.cache[id];
    try {
      const res = await fetch(
        `https://www.omdbapi.com/?apikey=${API_KEY}&i=${id}&plot=full`
      );
      const data = await res.json();
      if (data.Response === "True") {
        state.cache[id] = data;
        safeSave("movieCache", state.cache);
        return data;
      }
    } catch (e) {
      return null;
    }
  }

  function updatePaginationUI() {
    // Пагинация видна ТОЛЬКО если был совершен поиск в текущей сессии
    if (
      state.tab === "recent" &&
      state.totalResults > 0 &&
      state.currentQuery !== ""
    ) {
      paginationContainer.style.display = "flex";
      const loaded = state.movies.length;
      progressText.textContent = `Показано ${loaded} из ${state.totalResults}`;
      progressBar.style.width = `${Math.min(
        (loaded / state.totalResults) * 100,
        100
      )}%`;
      loadMoreBtn.style.display =
        loaded >= state.totalResults ? "none" : "block";
    } else {
      paginationContainer.style.display = "none";
    }
  }

  function render(list, append = false) {
    hideLoader();
    if (!append) grid.innerHTML = "";

    const sortedList = sortMovies(list);
    const fragment = document.createDocumentFragment();

    sortedList.forEach((m) => {
      const card = document.createElement("div");
      card.className = "card";
      const isFav = state.favorites.includes(m.imdbID);

      card.innerHTML = `
        ${
          m.Poster && m.Poster !== "N/A"
            ? `<img src="${m.Poster}" alt="${m.Title}" loading="lazy">`
            : `<div class="fallback">🎬</div>`
        }
        <div class="card-content">
          <h3>${m.Title}</h3>
          <span>${m.Year}</span>
        </div>
        <span class="favorite">${isFav ? "★" : "☆"}</span>
      `;

      const favBtn = card.querySelector(".favorite");
      favBtn.onclick = async (e) => {
        e.stopPropagation();
        if (state.favorites.includes(m.imdbID)) {
          state.favorites = state.favorites.filter((id) => id !== m.imdbID);
          favBtn.textContent = "☆";
        } else {
          state.favorites.push(m.imdbID);
          favBtn.textContent = "★";
          await getMovie(m.imdbID);
        }
        safeSave("favorites", state.favorites);
        favCount.textContent = `(${state.favorites.length})`;
        if (state.tab === "favorites") renderCurrentTab();
      };

      card.onclick = async () => {
        const fullData = await getMovie(m.imdbID);
        if (fullData) openModal(fullData);
      };
      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
    updatePaginationUI();
  }

  function sortMovies(list) {
    const type = sortSelect.value;
    return [...list].sort((a, b) => {
      if (type === "title") return a.Title.localeCompare(b.Title);
      if (type === "year") return parseInt(b.Year) - parseInt(a.Year);
      return 0;
    });
  }

  async function fetchMovies(query, page = 1) {
    if (page === 1) showLoader();
    else {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = "Загрузка...";
    }

    try {
      const res = await fetch(
        `https://www.omdbapi.com/?apikey=${API_KEY}&s=${query}&page=${page}`
      );
      const data = await res.json();

      if (data.Response === "True") {
        state.totalResults = parseInt(data.totalResults);
        state.movies =
          page === 1 ? data.Search : [...state.movies, ...data.Search];

        safeSave("lastSearch", state.movies);
        safeSave("lastTotal", state.totalResults);
        render(data.Search, page > 1);
      } else if (page === 1) {
        grid.innerHTML = `<p style="text-align:center; width:100%">${data.Error}</p>`;
        state.totalResults = 0;
        updatePaginationUI();
      }
    } catch (e) {
      console.error(e);
    } finally {
      hideLoader();
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = "Показать ещё";
    }
  }

  const startSearch = () => {
    state.currentQuery = searchInput.value.trim();
    if (!state.currentQuery) return;
    state.currentPage = 1;
    fetchMovies(state.currentQuery, 1);
  };

  $("#searchBtn").onclick = startSearch;
  searchInput.onkeydown = (e) => {
    if (e.key === "Enter") startSearch();
  };

  loadMoreBtn.onclick = () => {
    state.currentPage++;
    fetchMovies(state.currentQuery, state.currentPage);
  };

  function renderCurrentTab() {
    if (state.tab === "recent") {
      state.movies = JSON.parse(localStorage.getItem("lastSearch") || "[]");
      state.totalResults = parseInt(localStorage.getItem("lastTotal") || "0");
      render(state.movies);
    } else {
      const favs = state.favorites.map((id) => state.cache[id]).filter(Boolean);
      render(favs);
    }
  }

  function openModal(m) {
    $("#modalBody").innerHTML = `
      <div style="display:flex; gap:30px; flex-wrap:wrap">
        <img src="${
          m.Poster !== "N/A" ? m.Poster : ""
        }" style="max-width:250px; border-radius:10px">
        <div style="flex:1; min-width:300px">
          <h2 style="margin-bottom:15px">${m.Title} (${m.Year})</h2>
          <p><b>Рейтинг:</b> ⭐ ${m.imdbRating}</p>
          <p><b>Жанр:</b> ${m.Genre}</p>
          <p><b>Актеры:</b> ${m.Actors}</p>
          <p style="margin-top:20px; color:#cbd5e1; line-height:1.6">${
            m.Plot
          }</p>
        </div>
      </div>`;
    modal.classList.remove("hidden");
  }

  document.querySelectorAll(".tab").forEach((t) => {
    t.onclick = () => {
      document
        .querySelectorAll(".tab")
        .forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      state.tab = t.dataset.tab;
      renderCurrentTab();
    };
  });

  $("#clearHistory").onclick = () => {
    if (!confirm("Очистить историю поиска?")) return;
    localStorage.removeItem("lastSearch");
    localStorage.removeItem("lastTotal");
    state.movies = [];
    state.totalResults = 0;
    state.currentQuery = "";
    searchInput.value = "";
    renderCurrentTab();
  };

  modal.onclick = (e) => {
    if (e.target === modal || e.target.className === "close")
      modal.classList.add("hidden");
  };
  sortSelect.onchange = renderCurrentTab;

  // При старте
  favCount.textContent = `(${state.favorites.length})`;
  renderCurrentTab();
})();
