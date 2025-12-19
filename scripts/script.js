(() => {
  const API_KEY = "5dd58b01";
  const $ = (s) => document.querySelector(s);

  const grid = $("#grid");
  const modal = $("#modal");
  const modalBody = $("#modalBody");
  const favCount = $("#favCount");
  const favSearch = $("#favSearch");
  const sortSelect = $("#sortSelect");

  // Создаем элемент лоадера программно
  const loader = document.createElement("div");
  loader.className = "loader";

  let state = {
    tab: "recent",
    movies: [],
    favorites: JSON.parse(localStorage.getItem("favorites") || "[]"),
    cache: JSON.parse(localStorage.getItem("movieCache") || "{}"),
  };

  // Функции управления индикатором загрузки
  function showLoader() {
    grid.innerHTML = "";
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
        if (localStorage.getItem("movieCache")) {
          state.cache = {};
          localStorage.removeItem("movieCache");
        } else if (localStorage.getItem("lastSearch")) {
          localStorage.removeItem("lastSearch");
        }
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch (retryError) {
          alert("Память заполнена.");
        }
      }
    }
  }

  function saveEssential() {
    safeSave("favorites", state.favorites);
    safeSave("movieCache", state.cache);
  }

  async function getMovie(id) {
    if (state.cache[id]) return state.cache[id];

    // Показываем лоадер только если данных нет в кэше
    showLoader();
    try {
      const res = await fetch(
        `https://www.omdbapi.com/?apikey=${API_KEY}&i=${id}&plot=full`
      );
      const data = await res.json();
      if (data.Response === "True") {
        const keys = Object.keys(state.cache);
        if (keys.length > 50) delete state.cache[keys[0]];
        state.cache[id] = data;
        saveEssential();
        return data;
      }
    } catch (err) {
      console.error(err);
    } finally {
      hideLoader();
    }
    return null;
  }

  function render(list) {
    hideLoader();
    grid.innerHTML = "";
    const sortedList = sortMovies(list);

    if (!sortedList.length) {
      grid.innerHTML = "<p>Ничего не найдено</p>";
      return;
    }

    sortedList.forEach((m) => {
      const card = document.createElement("div");
      card.className = "card";
      const isFav = state.favorites.includes(m.imdbID);

      card.innerHTML = `
        <img src="${m.Poster !== "N/A" ? m.Poster : ""}" alt="${
        m.Title
      }" onerror="this.src='https://via.placeholder.com/300x450?text=No+Poster'">
        <div class="card-content">
          <h3>${m.Title}</h3>
          <span>${m.Year}</span>
        </div>
        <span class="favorite">${isFav ? "★" : "☆"}</span>
      `;

      card.querySelector(".favorite").onclick = async (e) => {
        e.stopPropagation();
        if (state.favorites.includes(m.imdbID)) {
          state.favorites = state.favorites.filter((id) => id !== m.imdbID);
        } else {
          state.favorites.push(m.imdbID);
          await getMovie(m.imdbID);
        }
        saveEssential();
        updateFavCount();
        renderCurrentTab();
      };

      card.onclick = async () => {
        const fullData = await getMovie(m.imdbID);
        if (fullData) openModal(fullData);
      };
      grid.appendChild(card);
    });
  }

  function sortMovies(list) {
    const type = sortSelect.value;
    const sorted = [...list];
    if (type === "title")
      sorted.sort((a, b) => (a.Title || "").localeCompare(b.Title || ""));
    if (type === "year")
      sorted.sort((a, b) => parseInt(b.Year || 0) - parseInt(a.Year || 0));
    return sorted;
  }

  function renderCurrentTab() {
    favSearch.style.display = state.tab === "favorites" ? "block" : "none";
    if (state.tab === "recent") {
      render(JSON.parse(localStorage.getItem("lastSearch") || "[]"));
    } else {
      render(state.favorites.map((id) => state.cache[id]).filter(Boolean));
    }
  }

  function updateFavCount() {
    favCount.textContent = `(${state.favorites.length})`;
  }

  function openModal(m) {
    modalBody.innerHTML = `
      <div class="modal-body">
        <img src="${m.Poster !== "N/A" ? m.Poster : ""}" alt="${m.Title}">
        <div>
          <h2>${m.Title} (${m.Year})</h2>
          <p><b>Genre:</b> ${m.Genre}</p>
          <p><b>IMDb:</b> ⭐ ${m.imdbRating}</p>
          <p>${m.Plot}</p>
        </div>
      </div>
    `;
    modal.classList.remove("hidden");
  }

  $("#searchInput").addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const q = e.target.value.trim();
    if (!q) return;

    showLoader();
    try {
      const res = await fetch(
        `https://www.omdbapi.com/?apikey=${API_KEY}&s=${q}`
      );
      const data = await res.json();
      if (data.Search) {
        safeSave("lastSearch", data.Search);
        render(data.Search);
      } else {
        render([]);
      }
    } catch (err) {
      console.error(err);
      hideLoader();
    }
  });

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
    localStorage.removeItem("lastSearch");
    if (state.tab === "recent") render([]);
  };

  modal.onclick = (e) => {
    if (e.target === modal || e.target.classList.contains("close"))
      modal.classList.add("hidden");
  };

  sortSelect.onchange = renderCurrentTab;
  updateFavCount();
  renderCurrentTab();
})();
