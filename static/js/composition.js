(() => {
  const dataNode = document.getElementById("composition-data");
  if (!dataNode) return;

  const data = JSON.parse(dataNode.textContent);
  const state = data.etat || {};
  const formations = {
    "4-3-3": [{ count: 4, role: "DEF" }, { count: 3, role: "MIL" }, { count: 3, role: "ATT" }],
    "4-4-2": [{ count: 4, role: "DEF" }, { count: 4, role: "MIL" }, { count: 2, role: "ATT" }],
    "4-2-3-1": [{ count: 4, role: "DEF" }, { count: 2, role: "MIL" }, { count: 3, role: "MIL" }, { count: 1, role: "ATT" }],
    "3-5-2": [{ count: 3, role: "DEF" }, { count: 5, role: "MIL" }, { count: 2, role: "ATT" }],
    "5-3-2": [{ count: 5, role: "DEF" }, { count: 3, role: "MIL" }, { count: 2, role: "ATT" }],
    "3-4-3": [{ count: 3, role: "DEF" }, { count: 4, role: "MIL" }, { count: 3, role: "ATT" }],
  };
  const roleLabels = { DEF: "Défense", MIL: "Milieu", ATT: "Attaque" };
  const pitch = document.getElementById("composition-pitch");
  const bench = document.getElementById("composition-bench");
  const benchCount = document.getElementById("bench-count");
  const benchEmpty = document.getElementById("bench-empty");
  const saveButton = document.getElementById("composition-save");
  const status = document.getElementById("composition-status");
  const formationSelect = document.getElementById("composition-formation");
  const deleteForm = document.querySelector("[data-delete-composition]");
  const deleteDialog = document.getElementById("delete-composition-dialog");
  const confirmDeleteButton = deleteDialog?.querySelector("[data-confirm-delete]");
  const cancelDeleteButton = deleteDialog?.querySelector("[data-cancel-delete]");
  const availableIds = new Set(data.joueurs
    .filter((player) => player.statut === "DISPONIBLE")
    .map((player) => player.id));
  const benchIds = new Set((state.remplacants || [])
    .map((item) => Number(item.joueur))
    .filter((id) => availableIds.has(id)));
  const starters = new Map((state.titulaires || []).map((item) => [Number(item.slot), Number(item.joueur)]));
  let slotSelects = [];

  const availablePlayers = data.joueurs.filter((player) => player.statut === "DISPONIBLE");
  const playerLabel = (player) => `${player.numero ? `#${player.numero} ` : ""}${player.prenom} ${player.nom}`;

  if (deleteForm && deleteDialog && confirmDeleteButton && cancelDeleteButton) {
    if (typeof deleteDialog.showModal === "function") {
      deleteForm.addEventListener("submit", (event) => {
        event.preventDefault();
        deleteDialog.showModal();
      });
      cancelDeleteButton.addEventListener("click", () => deleteDialog.close());
      confirmDeleteButton.addEventListener("click", () => {
        confirmDeleteButton.disabled = true;
        confirmDeleteButton.textContent = "Suppression en cours…";
        HTMLFormElement.prototype.submit.call(deleteForm);
      });
      deleteDialog.addEventListener("click", (event) => {
        if (event.target === deleteDialog) deleteDialog.close();
      });
    } else {
      deleteForm.addEventListener("submit", (event) => {
        if (!window.confirm("Supprimer définitivement cette composition ?")) event.preventDefault();
      });
    }
  }

  function setStatus(message, type) {
    status.textContent = message;
    status.classList.toggle("is-error", type === "error");
    status.classList.toggle("is-success", type === "success");
  }

  function selectedStarterIds() {
    return new Set(slotSelects.map((select) => Number(select.value)).filter(Boolean));
  }

  function updateSelectionOptions() {
    const starterIds = selectedStarterIds();
    starterIds.forEach((id) => benchIds.delete(id));
    const selectedBenchCount = bench.querySelectorAll("input:checked").length;
    slotSelects.forEach((select, index) => {
      Array.from(select.options).forEach((option) => {
        if (!option.value) return;
        const playerId = Number(option.value);
        const player = data.joueurs.find((item) => item.id === playerId);
        option.disabled = index === 0
          ? player?.poste !== "GB" || player?.statut !== "DISPONIBLE"
          : player?.poste === "GB" || player?.statut !== "DISPONIBLE";
        if (starterIds.has(playerId) && playerId !== Number(select.value)) option.disabled = true;
      });
    });

    const idsOnPitch = selectedStarterIds();
    bench.querySelectorAll("input[type=checkbox]").forEach((input) => {
      const id = Number(input.value);
      const unavailableByStarter = idsOnPitch.has(id);
      input.disabled = unavailableByStarter || (!input.checked && selectedBenchCount >= 9);
      input.closest(".bench-player").classList.toggle("is-selected", input.checked);
    });
    const chosen = Array.from(bench.querySelectorAll("input:checked"));
    benchCount.textContent = `${chosen.length} / 9 sélectionnés`;
    benchEmpty.hidden = availablePlayers.some((player) => !idsOnPitch.has(player.id) && !benchIds.has(player.id));

    updateRoleOptions("composition-captain", state.capitaine);
    updateRoleOptions("composition-penalty", state.penalty);
    updateRoleOptions("composition-free-kick", state.coup_franc);
  }

  function updateRoleOptions(id, selectedId) {
    const select = document.getElementById(id);
    const previous = select.value;
    select.replaceChildren(new Option("À désigner", ""));
    slotSelects.forEach((slot) => {
      const player = data.joueurs.find((item) => item.id === Number(slot.value));
      if (!player) return;
      const option = new Option(playerLabel(player), player.id);
      select.add(option);
    });
    const desired = previous || (selectedId ? String(selectedId) : "");
    if (Array.from(select.options).some((option) => option.value === desired)) select.value = desired;
  }

  function buildSelect(slotIndex, position) {
    const wrapper = document.createElement("label");
    wrapper.className = "formation-slot";
    wrapper.style.left = `${position.x}%`;
    wrapper.style.top = `${position.y}%`;
    wrapper.style.width = position.count ? `${90 / (position.count + 1)}%` : "20%";

    const title = document.createElement("span");
    title.className = "formation-slot-label";
    title.textContent = position.role;
    wrapper.append(title);

    const select = document.createElement("select");
    select.setAttribute("aria-label", `${position.role} ${slotIndex}`);
    select.dataset.slot = String(slotIndex);
    select.add(new Option(position.role === "Gardien" ? "Choisir gardien" : "Choisir joueur", ""));
    data.joueurs.forEach((player) => {
      const option = new Option(
        `${playerLabel(player)} · ${player.poste_label}${player.statut !== "DISPONIBLE" ? ` · ${player.statut_label}` : ""}`,
        player.id,
      );
      if (player.statut !== "DISPONIBLE") option.disabled = true;
      select.add(option);
    });
    if (starters.has(slotIndex)) select.value = String(starters.get(slotIndex));
    select.addEventListener("change", () => {
      if (select.value) starters.set(slotIndex, Number(select.value));
      else starters.delete(slotIndex);
      benchIds.delete(Number(select.value));
      renderBench();
      updateSelectionOptions();
      if (select.options[select.selectedIndex]?.disabled) setStatus("Ce joueur n’est pas disponible pour le match.", "error");
    });
    wrapper.append(select);
    return { wrapper, select };
  }

  function formationPositions(formation) {
    const rows = formations[formation] || formations["4-3-3"];
    const positions = [{ x: 50, y: 92, role: "Gardien" }];
    rows.forEach((row, rowIndex) => {
      const y = rows.length === 1 ? 55 : 82 - (rowIndex * 64) / (rows.length - 1);
      for (let index = 0; index < row.count; index += 1) {
        positions.push({
          x: ((index + 1) * 100) / (row.count + 1),
          y,
          role: roleLabels[row.role],
          tacticalRole: row.role,
          count: row.count,
        });
      }
    });
    return positions;
  }

  function renderPitch() {
    const oldValues = slotSelects.map((select) => Number(select.value) || null);
    pitch.replaceChildren();
    slotSelects = [];
    formationPositions(formationSelect.value).forEach((position, index) => {
      const slot = index + 1;
      const { wrapper, select } = buildSelect(slot, position);
      if (!starters.has(slot) && oldValues[index]) select.value = String(oldValues[index]);
      pitch.append(wrapper);
      slotSelects.push(select);
    });
    updateSelectionOptions();
  }

  function renderBench() {
    const starterIds = selectedStarterIds();
    bench.replaceChildren();
    availablePlayers.forEach((player) => {
      const label = document.createElement("label");
      label.className = "bench-player";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = String(player.id);
      input.checked = benchIds.has(player.id) && !starterIds.has(player.id);
      input.addEventListener("change", () => {
        if (input.checked) benchIds.add(player.id);
        else benchIds.delete(player.id);
        updateSelectionOptions();
      });
      const text = document.createElement("span");
      text.append(document.createTextNode(playerLabel(player)));
      const meta = document.createElement("small");
      meta.textContent = `${player.poste_label}${player.pied ? ` · pied ${player.pied.toLowerCase()}` : ""}`;
      text.append(meta);
      label.append(input, text);
      bench.append(label);
    });
    updateSelectionOptions();
  }

  formationSelect.addEventListener("change", renderPitch);

  saveButton.addEventListener("click", async () => {
    const selected = slotSelects.map((select, index) => {
      const position = formationPositions(formationSelect.value)[index];
      return {
        slot_index: index + 1,
        joueur_id: Number(select.value) || null,
        poste_tactique: index === 0 ? "GB" : position.tacticalRole,
        x: position.x,
        y: position.y,
      };
    });
    const titulaires = selected.filter((item) => item.joueur_id !== null);
    if (titulaires.length !== 11) {
      setStatus("Sélectionnez 11 titulaires, dont un gardien.", "error");
      return;
    }

    const remplaçants = Array.from(bench.querySelectorAll("input:checked")).map((input, index) => ({
      joueur_id: Number(input.value),
      slot_index: index + 1,
    }));
    if (remplaçants.length > 9) {
      setStatus("Vous pouvez sélectionner au maximum 9 remplaçants.", "error");
      return;
    }

    const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]")?.value;
    const payload = {
      id: state.id || null,
      nom: document.getElementById("composition-name").value,
      dispositif: formationSelect.value,
      match_id: document.getElementById("composition-match").value || null,
      capitaine_id: document.getElementById("composition-captain").value || null,
      penalty_id: document.getElementById("composition-penalty").value || null,
      coup_franc_id: document.getElementById("composition-free-kick").value || null,
      notes: document.getElementById("composition-notes").value,
      titulaires,
      remplacants: remplaçants,
    };

    saveButton.disabled = true;
    setStatus("Enregistrement en cours…");
    try {
      const response = await fetch(data.urlSauvegarde, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setStatus(result.erreurs?.join(" ") || "L’enregistrement a échoué. Réessayez.", "error");
        return;
      }
      state.id = result.id;
      setStatus(`${result.message} · Mise à jour à ${result.maj}.`, "success");
      window.history.replaceState({}, "", result.url);
      window.setTimeout(() => window.location.reload(), 650);
    } catch (error) {
      setStatus("Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.", "error");
    } finally {
      saveButton.disabled = false;
    }
  });

  renderPitch();
  renderBench();
})();
