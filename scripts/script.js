(() => {
  const API_KEY = "5dd58b01";
  const $ = (s) => document.querySelector(s);

  const grid = $("#grid");
  const modal = $("#modal");
  const modalBody = $("#modalBody");
  const favCount = $("#favCount");
  const favSearch = $("#favSearch");
  const sortSelect = $("#sortSelect");

  // Инициализация состояния с безопасным чтением из LocalStorage
  let state = {
    tab: "recent",
    movies: [],
    // Загружаем только ID избранного, чтобы не дублировать объекты
    favorites: JSON.parse(localStorage.getItem("favorites") || "[]"),
    // Кэш подробных данных о фильмах с проверкой на null
    cache: JSON.parse(localStorage.getItem("movieCache") || "{}"),
  };

  /**
   * Каскадная очистка данных при переполнении LocalStorage.
   * Если место заканчивается, поочередно удаляются: кэш, затем история поиска.
   */
  function safeSave(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      if (e.name === "QuotaExceededError") {
        console.warn("Экстренная очистка: LocalStorage переполнен.");

        // Уровень 1: Удаляем тяжелый кэш подробных данных
        if (localStorage.getItem("movieCache")) {
          state.cache = {};
          localStorage.removeItem("movieCache");
          console.log("Уровень 1: Кэш фильмов удален.");
        }
        // Уровень 2: Удаляем историю последнего поиска
        else if (localStorage.getItem("lastSearch")) {
          localStorage.removeItem("lastSearch");
          console.log("Уровень 2: История поиска удалена.");
        }

        // Повторная попытка сохранить критические данные (например, Избранное)
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch (retryError) {
          console.error("Критическая ошибка: место не освободилось.");
          alert(
            "Не удалось сохранить данные: память браузера полностью заполнена."
          );
        }
      }
    }
  }

  function saveEssential() {
    safeSave("favorites", state.favorites);
    safeSave("movieCache", state.cache);
  }

  function updateFavCount() {
    favCount.textContent = `(${state.favorites.length})`;
  }

  /**
   * Получение данных о фильме с использованием LRU-кэширования.
   * Ограничивает кэш до 50 записей, чтобы избежать раздувания хранилища.
   */
  async function getMovie(id) {
    if (state.cache[id]) return state.cache[id];

    try {
      const res = await fetch(
        `https://www.omdbapi.com/?apikey=${API_KEY}&i=${id}&plot=full`
      );
      const data = await res.json();

      if (data.Response === "True") {
        const keys = Object.keys(state.cache);
        // Логика LRU: удаляем самую старую запись при превышении лимита
        if (keys.length > 50) {
          delete state.cache[keys[0]];
        }
        state.cache[id] = data;
        saveEssential();
        return data;
      }
    } catch (err) {
      console.error("Ошибка API:", err);
    }
    return null;
  }

  function sortMovies(list) {
    const type = sortSelect.value;
    const sorted = [...list];
    if (type === "title")
      sorted.sort((a, b) => (a.Title || "").localeCompare(b.Title || ""));
    if (type === "year")
      sorted.sort((a, b) => parseInt(b.Year || 0) - parseInt(a.Year || 0));
    if (type === "genre")
      sorted.sort((a, b) => (a.Genre || "").localeCompare(b.Genre || ""));
    return sorted;
  }

  function render(list) {
    grid.innerHTML = "";
    const sortedList = sortMovies(list);

    if (!sortedList.length) {
      grid.innerHTML = "<p>Список пуст</p>";
      return;
    }

    sortedList.forEach((m) => {
      const card = document.createElement("div");
      card.className = "card";

      const isFav = state.favorites.includes(m.imdbID);

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
      favSpan.textContent = isFav ? "★" : "☆";
      favSpan.onclick = async (e) => {
        e.stopPropagation();
        if (state.favorites.includes(m.imdbID)) {
          state.favorites = state.favorites.filter((id) => id !== m.imdbID);
        } else {
          state.favorites.push(m.imdbID);
          // Предварительно кэшируем полные данные для избранного
          await getMovie(m.imdbID);
        }
        saveEssential();
        updateFavCount();
        renderCurrentTab();
      };
      card.appendChild(favSpan);

      card.onclick = async () => {
        const fullData = await getMovie(m.imdbID);
        if (fullData) openModal(fullData);
      };
      grid.appendChild(card);
    });
  }

  function renderCurrentTab() {
    favSearch.style.display = state.tab === "favorites" ? "block" : "none";

    if (state.tab === "recent") {
      // Надежное чтение истории поиска с дефолтным значением
      const lastSearch = JSON.parse(localStorage.getItem("lastSearch") || "[]");
      render(lastSearch);
    } else if (state.tab === "favorites") {
      // Собираем данные из кэша на основе сохраненных ID избранного
      const favList = state.favorites
        .map((id) => state.cache[id])
        .filter((movie) => movie !== undefined);
      render(favList);
    }
  }

  function openModal(m) {
    modalBody.innerHTML = `
      <div class="modal-body">
        <img src="${m.Poster !== "N/A" ? m.Poster : ""}" alt="${m.Title}">
        <div>
          <h2>${m.Title} (${m.Year})</h2>
          <p><b>Genre:</b> ${m.Genre}</p>
          <p><b>IMDb:</b> ⭐ ${m.imdbRating}</p>
          <p><b>Runtime:</b> ${m.Runtime}</p>
          <p><b>Actors:</b> ${m.Actors}</p>
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

    try {
      const res = await fetch(
        `https://www.omdbapi.com/?apikey=${API_KEY}&s=${q}`
      );
      const data = await res.json();
      if (data.Search) {
        state.movies = data.Search;
        // Используем safeSave для сохранения результатов поиска
        safeSave("lastSearch", data.Search);
        render(data.Search);
      }
    } catch (err) {
      console.error("Ошибка поиска:", err);
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
    if (state.tab === "recent") grid.innerHTML = "<p>История очищена</p>";
  };

  favSearch.oninput = () => {
    const q = favSearch.value.toLowerCase();
    const filtered = state.favorites
      .map((id) => state.cache[id])
      .filter((m) => m && m.Title.toLowerCase().includes(q));
    render(filtered);
  };

  modal.onclick = (e) => {
    if (e.target === modal || e.target.classList.contains("close"))
      modal.classList.add("hidden");
  };

  sortSelect.onchange = renderCurrentTab;

  // Инициализация интерфейса
  updateFavCount();
  renderCurrentTab();
})();
// Как теперь работает стратегия управления памятью:
// Превентивная мера (LRU-кэш): В функции getMovie мы сохраняем не более 50 последних фильмов. Это предотвращает раздувание базы при обычном использовании.
// Первый уровень защиты (Очистка кэша): Если при добавлении в избранное возникает ошибка, safeSave первым делом удаляет movieCache. Это освобождает значительный объем данных, так как полные описания фильмов с сюжетом и ссылками на постеры занимают много места.
// Второй уровень защиты (Очистка истории): Если удаление кэша не помогло, система жертвует историей последнего поиска (lastSearch).
// Приоритет данных: Система до последнего пытается сохранить массив favorites, так как это персональные данные пользователя, которые труднее всего восстановить.
// При возникновении ошибки переполнения в консоли увидим отчет о том, какие именно данные были удалены для спасения работоспособности приложения.
