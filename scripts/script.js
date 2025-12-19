(() => {
  const API_KEY = "5dd58b01";
  const $ = (s) => document.querySelector(s);
  const grid = $("#grid");
  const modal = $("#modal");
  const modalBody = $("#modalBody");
  const favCount = $("#favCount");
  const favSearch = $("#favSearch");
  let state = {
    tab: "recent",
    movies: [],
    favorites: JSON.parse(localStorage.getItem("favorites")) || [],
    favoriteMovies: JSON.parse(localStorage.getItem("favoriteMovies")) || {},
    cache: JSON.parse(localStorage.getItem("movieCache")) || {},
  };

  function save() {
    localStorage.setItem("favorites", JSON.stringify(state.favorites));
    localStorage.setItem(
      "favoriteMovies",
      JSON.stringify(state.favoriteMovies)
    );
    localStorage.setItem("movieCache", JSON.stringify(state.cache));
  }

  function updateFavCount() {
    state.favorites = Object.keys(state.favoriteMovies);
    favCount.textContent = `(${state.favorites.length})`;
  }

  async function getMovie(id) {
    if (state.cache[id]) return state.cache[id];
    const res = await fetch(
      `https://www.omdbapi.com/?apikey=${API_KEY}&i=${id}&plot=full`
    );
    const data = await res.json();
    state.cache[id] = data;
    save();
    return data;
  }

  function sortMovies(list) {
    const type = $("#sortSelect").value;
    const sorted = [...list];
    if (type === "title") sorted.sort((a, b) => a.Title.localeCompare(b.Title));
    if (type === "year") sorted.sort((a, b) => Number(b.Year) - Number(a.Year));
    if (type === "genre")
      sorted.sort((a, b) => (a.Genre || "").localeCompare(b.Genre || ""));
    return sorted;
  }

  function render(list) {
    grid.innerHTML = "";
    const sortedList = sortMovies(list);
    if (!sortedList.length) {
      grid.innerHTML = "<p>Ничего не найдено</p>";
      return;
    }

    sortedList.forEach((m) => {
      const card = document.createElement("div");
      card.className = "card";

      const fav = state.favorites.includes(m.imdbID);
      const img = document.createElement("img");
      img.src = m.Poster !== "N/A" ? m.Poster : "";
      img.alt = m.Title;
      img.onerror = () => {
        const fb = document.createElement("div");
        fb.className = "fallback";
        fb.textContent = "✖";
        img.replaceWith(fb);
      };
      card.appendChild(img);

      const content = document.createElement("div");
      content.className = "card-content";
      content.innerHTML = `<h3>${m.Title}</h3><span>${m.Year}</span>`;
      card.appendChild(content);

      const favSpan = document.createElement("span");
      favSpan.className = "favorite";
      favSpan.textContent = fav ? "★" : "☆";
      favSpan.onclick = async (e) => {
        e.stopPropagation();
        if (state.favorites.includes(m.imdbID)) {
          state.favorites = state.favorites.filter((id) => id !== m.imdbID);
          delete state.favoriteMovies[m.imdbID];
        } else {
          state.favorites.push(m.imdbID);
          state.favoriteMovies[m.imdbID] = await getMovie(m.imdbID);
        }
        save();
        updateFavCount();
        renderCurrentTab();
      };
      card.appendChild(favSpan);

      card.onclick = async () => openModal(await getMovie(m.imdbID));
      grid.appendChild(card);
    });
  }

  function renderFavorites() {
    favSearch.style.display = "block";
    render(Object.values(state.favoriteMovies));
  }

  function renderCurrentTab() {
    favSearch.style.display = "none";
    if (state.tab === "recent")
      render(JSON.parse(localStorage.getItem("lastSearch")) || []);
    if (state.tab === "favorites") renderFavorites();
  }

  async function openModal(m) {
    modalBody.innerHTML = "";
    const modalContent = document.createElement("div");
    modalContent.className = "modal-body";

    const poster = document.createElement("img");
    poster.src = m.Poster !== "N/A" ? m.Poster : "";
    poster.alt = m.Title;
    poster.onerror = () => {
      const fb = document.createElement("div");
      fb.className = "fallback";
      fb.style.height = "300px";
      fb.textContent = "✖";
      poster.replaceWith(fb);
    };
    modalContent.appendChild(poster);

    const textDiv = document.createElement("div");
    textDiv.innerHTML = `
    <h2>${m.Title} (${m.Year})</h2>
    <p><b>Genre:</b> ${m.Genre}</p>
    <p><b>IMDb:</b> ⭐ ${m.imdbRating}</p>
    <p><b>Runtime:</b> ${m.Runtime}</p>
    <p><b>Actors:</b> ${m.Actors}</p>
    <p>${m.Plot}</p>
  `;
    modalContent.appendChild(textDiv);

    modalBody.appendChild(modalContent);
    modal.classList.remove("hidden");
  }

  $("#searchInput").addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const q = e.target.value.trim();
    if (!q) return;
    const res = await fetch(
      `https://www.omdbapi.com/?apikey=${API_KEY}&s=${q}`
    );
    const data = await res.json();
    if (data.Search) {
      state.movies = data.Search;
      localStorage.setItem("lastSearch", JSON.stringify(data.Search));
      render(data.Search);
    }
  });

  document.querySelectorAll(".tab").forEach(
    (t) =>
      (t.onclick = () => {
        document
          .querySelectorAll(".tab")
          .forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        state.tab = t.dataset.tab;
        renderCurrentTab();
      })
  );

  $("#clearHistory").onclick = () => {
    localStorage.removeItem("lastSearch");
    if (state.tab === "recent") grid.innerHTML = "<p>История очищена</p>";
  };

  favSearch.oninput = () => {
    const q = favSearch.value.toLowerCase();
    render(
      Object.values(state.favoriteMovies).filter((m) =>
        m.Title.toLowerCase().includes(q)
      )
    );
  };

  modal.onclick = (e) => {
    if (e.target === modal || e.target.classList.contains("close"))
      modal.classList.add("hidden");
  };

  $("#sortSelect").onchange = renderCurrentTab;

  updateFavCount();
  render(JSON.parse(localStorage.getItem("lastSearch")) || []);
})();
