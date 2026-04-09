const dom = {
	errorBanner: document.getElementById("errorBanner"),
	connectionStatus: document.getElementById("connectionStatus"),
	dataSourceState: document.getElementById("dataSourceState"),
	exportBtn: document.getElementById("exportBtn"),
	saveInfo: document.getElementById("saveInfo"),
	lastChangeStatus: document.getElementById("lastChangeStatus"),
	statTotal: document.getElementById("statTotal"),
	statActive: document.getElementById("statActive"),
	statInactive: document.getElementById("statInactive"),
	statOpenPayments: document.getElementById("statOpenPayments"),
	searchInput: document.getElementById("searchInput"),
	filterSelect: document.getElementById("filterSelect"),
	clientsContainer: document.getElementById("clientsContainer"),
	resultCount: document.getElementById("resultCount"),
	emptyState: document.getElementById("emptyState"),
	clientCardTemplate: document.getElementById("clientCardTemplate"),
	detailsModal: document.getElementById("detailsModal"),
	closeModalBtn: document.getElementById("closeModalBtn"),
	modalTitle: document.getElementById("modalTitle"),
	modalBody: document.getElementById("modalBody")
};

const state = {
	clients: [],
	rawClients: [],
	rawEnvelope: null,
	search: "",
	filter: "all",
	lastChangeAt: null,
	saveInfoTimeoutId: null,
	supabaseConnected: false
};

const CLIENT_ACTIONS = {
	activate: {
		label: "Aktivieren",
		createPayload: () => ({ active: true }),
		applyLocal: () => ({ active: true })
	},
	"payment-open": {
		label: "Zahlung offen",
		createPayload: () => ({ paymentStatus: "offen" }),
		applyLocal: () => ({ paymentStatus: "offen" })
	},
	"payment-paid": {
		label: "Zahlung bezahlt",
		createPayload: () => ({ paymentStatus: "bezahlt" }),
		applyLocal: () => ({ paymentStatus: "bezahlt" })
	}
};

const demoMetadataById = {
	kunde123: {
		monthlyPrice: 149,
		paymentStatus: "bezahlt",
		website: "https://kunde123-demo.ch",
		note: "Hauptkunde, aktiv im Test"
	},
	kunde999: {
		monthlyPrice: 149,
		paymentStatus: "offen",
		website: "https://kunde999-demo.ch",
		note: "Inaktiv wegen offener Zahlung"
	}
};

const fallbackClients = [
	{
		id: "kunde123",
		businessName: "Alpen Pflege GmbH",
		active: true,
		phone: "+41 44 111 22 33",
		email: "kontakt@alpen-pflege.ch",
		address: "Bahnhofstrasse 10, 8001 Zuerich",
		openingHours: "Mo-Fr 08:00-18:00",
		pricing: "Starter 149 CHF/Monat",
		tone: "professionell"
	},
	{
		id: "kunde999",
		businessName: "Nordstern Studio",
		active: false,
		phone: "+41 31 999 88 77",
		email: "hello@nordstern-studio.ch",
		address: "Marktgasse 2, 3011 Bern",
		openingHours: "Mo-Sa 09:00-19:00",
		pricing: "Growth 229 CHF/Monat",
		tone: "freundlich"
	}
];

function normalizeActive(value) {
	return value === true;
}

function normalizePaymentStatus(value) {
	const raw = String(value || "").toLowerCase();
	if (raw.includes("paid") || raw.includes("bezahlt")) {
		return "bezahlt";
	}
	return "offen";
}

function valueOrFallback(value, fallback = "-") {
	if (value === null || value === undefined) {
		return fallback;
	}
	const text = String(value).trim();
	return text ? text : fallback;
}

function compactValue(value) {
	if (value === null || value === undefined) {
		return "-";
	}
	if (Array.isArray(value)) {
		return value.length ? value.join(", ") : "-";
	}
	if (typeof value === "object") {
		const items = Object.entries(value)
			.filter(([, itemValue]) => itemValue !== null && itemValue !== undefined && String(itemValue).trim() !== "")
			.map(([key, itemValue]) => `${key}: ${itemValue}`);
		return items.length ? items.join(" | ") : "-";
	}
	return valueOrFallback(value);
}

function buildAddress(raw) {
	if (raw.address) {
		return compactValue(raw.address);
	}

	const parts = [raw.street, raw.houseNumber, raw.zip, raw.city, raw.country]
		.filter((item) => item !== null && item !== undefined && String(item).trim() !== "")
		.map((item) => String(item).trim());

	return parts.length ? parts.join(", ") : "-";
}

function withDemoMetadata(client) {
	const demo = demoMetadataById[client.id] || {};

	const monthlyPrice = Number(client.monthlyPrice ?? demo.monthlyPrice ?? 149);
	const paymentStatus = normalizePaymentStatus(client.paymentStatus ?? demo.paymentStatus ?? "offen");

	return {
		...client,
		monthlyPrice,
		paymentStatus,
		website: valueOrFallback(client.website ?? demo.website),
		note: valueOrFallback(client.note ?? demo.note, "Keine Notiz hinterlegt")
	};
}

function normalizeClient(raw, index) {
	const id = valueOrFallback(raw.id ?? raw.clientId ?? raw.kundenId ?? raw.customerId, `kunde-${index + 1}`);
	const businessName = valueOrFallback(raw.businessName ?? raw.companyName ?? raw.firma, `Kunde ${index + 1}`);
	const client = {
		id,
		businessName,
		active: normalizeActive(raw.active),
		phone: valueOrFallback(raw.phone ?? raw.telephone ?? raw.telefon),
		email: valueOrFallback(raw.email),
		address: buildAddress(raw),
		openingHours: compactValue(raw.openingHours ?? raw.openHours ?? raw.hours),
		pricing: compactValue(raw.prices ?? raw.pricing ?? raw.preise),
		tone: valueOrFallback(raw.tone),
		monthlyPrice: raw.monthlyPrice,
		paymentStatus: raw.paymentStatus,
		note: raw.note,
		website: raw.website
	};

	return withDemoMetadata(client);
}

function extractClientId(raw, index) {
	return valueOrFallback(raw.id ?? raw.clientId ?? raw.kundenId ?? raw.customerId, `kunde-${index + 1}`);
}

function cloneDeep(value) {
	return JSON.parse(JSON.stringify(value));
}

function renderLastChangeStatus() {
	if (!state.lastChangeAt) {
		dom.lastChangeStatus.textContent = "Letzte Änderung: keine";
		return;
	}

	const elapsedSeconds = Math.max(0, Math.floor((Date.now() - state.lastChangeAt) / 1000));
	dom.lastChangeStatus.textContent = `Letzte Änderung: vor ${elapsedSeconds} Sekunden`;
}

function showSaveInfo(message = "Änderung gespeichert") {
	dom.saveInfo.textContent = message;
	dom.saveInfo.classList.remove("hidden");

	if (state.saveInfoTimeoutId) {
		clearTimeout(state.saveInfoTimeoutId);
	}

	state.saveInfoTimeoutId = window.setTimeout(() => {
		dom.saveInfo.classList.add("hidden");
	}, 2800);
}

function showSaveFailed(message = "Speichern fehlgeschlagen") {
	showSaveInfo(`❌ ${message}`);
}

function markClientChangeSaved() {
	state.lastChangeAt = Date.now();
	renderLastChangeStatus();
	showSaveInfo("✓ Änderung gespeichert");
}

function showError(message) {
	dom.errorBanner.textContent = message;
	dom.errorBanner.classList.remove("hidden");
}

function hideError() {
	dom.errorBanner.classList.add("hidden");
	dom.errorBanner.textContent = "";
}

function renderStats() {
	const total = state.clients.length;
	const active = state.clients.filter((client) => client.active === true).length;
	const inactive = state.clients.filter((client) => client.active === false).length;
	const openPayments = state.clients.filter((client) => client.paymentStatus === "offen").length;

	dom.statTotal.textContent = String(total);
	dom.statActive.textContent = String(active);
	dom.statInactive.textContent = String(inactive);
	dom.statOpenPayments.textContent = String(openPayments);
}

function getFilteredClients() {
	const searchTerm = state.search.trim().toLowerCase();

	return state.clients.filter((client) => {
		const matchesSearch =
			!searchTerm ||
			client.businessName.toLowerCase().includes(searchTerm) ||
			client.id.toLowerCase().includes(searchTerm);

		const matchesFilter =
			state.filter === "all" ||
			(state.filter === "active" && client.active === true) ||
			(state.filter === "inactive" && client.active === false) ||
			(state.filter === "payment-open" && client.paymentStatus === "offen") ||
			(state.filter === "payment-paid" && client.paymentStatus === "bezahlt");

		return matchesSearch && matchesFilter;
	});
}

function createField(label, value) {
	const item = document.createElement("div");
	item.className = "field";

	const title = document.createElement("p");
	title.className = "field-label";
	title.textContent = label;

	const text = document.createElement("p");
	text.className = "field-value";
	text.textContent = valueOrFallback(value);

	item.append(title, text);
	return item;
}

function createBadge(text, className) {
	const badge = document.createElement("span");
	badge.className = `badge ${className}`;
	badge.textContent = text;
	return badge;
}

function createActionButton(text, action, className, clientId) {
	const button = document.createElement("button");
	button.type = "button";
	button.className = `btn ${className}`;
	button.dataset.action = action;
	button.dataset.clientId = clientId;
	button.textContent = text;
	return button;
}

function renderClientCard(client) {
	const fragment = dom.clientCardTemplate.content.cloneNode(true);

	const card = fragment.querySelector(".client-card");
	card.dataset.clientId = client.id;

	fragment.querySelector(".client-id").textContent = `ID: ${client.id}`;
	fragment.querySelector(".client-name").textContent = client.businessName;

	const badgeContainer = fragment.querySelector(".client-badges");
	badgeContainer.append(
		createBadge(
			client.active === true ? "Aktiv" : "Inaktiv",
			client.active === true ? "badge-active" : "badge-inactive"
		)
	);
	badgeContainer.append(
		createBadge(
			client.paymentStatus === "offen" ? "Zahlung offen" : "Zahlung bezahlt",
			client.paymentStatus === "offen" ? "badge-payment-open" : "badge-payment-paid"
		)
	);

	const info = fragment.querySelector(".client-info");
	info.append(
		createField("Telefon", client.phone),
		createField("E-Mail", client.email),
		createField("Monatsbetrag", `${client.monthlyPrice} CHF`),
		createField("Notiz", client.note)
	);

	const actions = fragment.querySelector(".client-actions");
	actions.append(
		createActionButton("Aktivieren", "activate", "btn-ok", client.id),
		createActionButton("Deaktivieren", "deactivate", "btn-danger", client.id),
		createActionButton("Zahlung offen", "payment-open", "btn-danger", client.id),
		createActionButton("Zahlung bezahlt", "payment-paid", "btn-ok", client.id),
		createActionButton("Details", "details", "btn-primary btn-details", client.id)
	);

	return fragment;
}

function renderClients() {
	const filtered = getFilteredClients();
	dom.clientsContainer.replaceChildren();

	filtered.forEach((client) => {
		dom.clientsContainer.append(renderClientCard(client));
	});

	dom.resultCount.textContent = `${filtered.length} Einträge`;
	dom.emptyState.classList.toggle("hidden", filtered.length > 0);
}

function renderAll() {
	renderStats();
	renderClients();
}

function getClientById(id) {
	return state.clients.find((client) => client.id === id);
}

function openDetails(clientId) {
	const client = getClientById(clientId);
	if (!client) {
		return;
	}

	dom.modalTitle.textContent = `${client.businessName} (${client.id})`;
	dom.modalBody.replaceChildren(
		createField("Status", client.active === true ? "Aktiv" : "Inaktiv"),
		createField("Zahlungsstatus", client.paymentStatus),
		createField("Telefon", client.phone),
		createField("E-Mail", client.email),
		createField("Adresse", client.address),
		createField("Öffnungszeiten", client.openingHours),
		createField("Preise", client.pricing),
		createField("Ton", client.tone),
		createField("Monatsbetrag", `${client.monthlyPrice} CHF`),
		createField("Website", client.website),
		createField("Notiz", client.note)
	);

	dom.detailsModal.classList.remove("hidden");
}

function closeDetails() {
	dom.detailsModal.classList.add("hidden");
}

function updateRawClient(clientId, updates) {
	state.rawClients = state.rawClients.map((rawClient, index) => {
		const rawId = extractClientId(rawClient, index);
		if (rawId !== clientId) {
			return rawClient;
		}

		const nextRawClient = { ...rawClient, ...updates };

		if (updates.paymentStatus) {
			nextRawClient.paymentStatus = updates.paymentStatus;
		}

		return nextRawClient;
	});
}

function restoreClientState(previousClients, previousRawClients) {
	state.clients = previousClients;
	state.rawClients = previousRawClients;
	renderAll();
}

function runClientAction(clientId, actionKey) {
	const actionConfig = CLIENT_ACTIONS[actionKey];
	if (!actionConfig) {
		return;
	}

	const updatePayload = actionConfig.createPayload();
	const localUpdates = actionConfig.applyLocal();

	const previousClients = cloneDeep(state.clients);
	const previousRawClients = cloneDeep(state.rawClients);

	state.clients = state.clients.map((client) => (client.id === clientId ? { ...client, ...localUpdates } : client));
	updateRawClient(clientId, localUpdates);

	if (!state.supabaseConnected) {
		restoreClientState(previousClients, previousRawClients);
		showSaveFailed("Speichern fehlgeschlagen");
		showError("Supabase ist nicht verbunden");
		return;
	}

	renderAll();

	updateClientAndVerify(clientId, updatePayload)
		.then((result) => {
			if (result.success && result.comparisonOk) {
				if (result.verifiedRow) {
					state.clients = state.clients.map((client) =>
						client.id === clientId ? { ...client, ...result.verifiedRow } : client
					);
					updateRawClient(clientId, result.verifiedRow);
				}
				hideError();
				markClientChangeSaved();
				renderAll();
				return;
			}

			restoreClientState(previousClients, previousRawClients);
			showSaveFailed("Speichern fehlgeschlagen");
		})
		.catch(() => {
			restoreClientState(previousClients, previousRawClients);
			showSaveFailed("Speichern fehlgeschlagen");
		});
}

/**
 * Fallback: Speichern via API
 */
function saveViaApi(clientId, updates) {
	const payload = buildExportPayload();
	
	fetch('/api/clients', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(payload)
	})
	.then(response => {
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		return response.json();
	})
	.then(() => {
		markClientChangeSaved();
	})
	.catch(error => {
		showSaveFailed(`Fehler: ${error.message}`);
	});
}

function buildExportPayload() {
	const exportedClients = state.rawClients.map((rawClient, index) => {
		const rawId = extractClientId(rawClient, index);
		const enrichedClient = getClientById(rawId);

		if (!enrichedClient) {
			return rawClient;
		}

		const exportClient = {
			...rawClient,
			active: enrichedClient.active,
			paymentStatus: enrichedClient.paymentStatus
		};

		const hasDemoProfile = Boolean(demoMetadataById[rawId]);
		if (hasDemoProfile || Object.hasOwn(rawClient, "monthlyPrice")) {
			exportClient.monthlyPrice = enrichedClient.monthlyPrice;
		}
		if (hasDemoProfile || Object.hasOwn(rawClient, "website")) {
			exportClient.website = enrichedClient.website;
		}
		if (hasDemoProfile || Object.hasOwn(rawClient, "note")) {
			exportClient.note = enrichedClient.note;
		}

		return exportClient;
	});

	if (state.rawEnvelope && typeof state.rawEnvelope === "object") {
		return {
			...state.rawEnvelope,
			clients: exportedClients
		};
	}

	return exportedClients;
}

function exportClientsJson() {
	const payload = buildExportPayload();
	const content = `${JSON.stringify(payload, null, 2)}\n`;
	const blob = new Blob([content], { type: "application/json" });
	const objectUrl = URL.createObjectURL(blob);

	const link = document.createElement("a");
	link.href = objectUrl;
	link.download = "clients.json";
	document.body.append(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(objectUrl);
}

function wireEvents() {
	dom.searchInput.addEventListener("input", (event) => {
		state.search = event.target.value;
		renderClients();
	});

	dom.filterSelect.addEventListener("change", (event) => {
		state.filter = event.target.value;
		renderClients();
	});

	dom.clientsContainer.addEventListener("click", (event) => {
		const button = event.target.closest("button[data-action]");
		if (!button) {
			return;
		}

		const { action, clientId: rawClientId } = button.dataset;
		if (!rawClientId) {
			return;
		}
		const clientId = String(rawClientId).trim();

		if (action === "activate") {
			runClientAction(clientId, "activate");
			return;
		}

		if (action === "deactivate") {
			(async () => {
				try {
					const supabase = window.__directSupabaseClient;
					if (!supabase) {
						showSaveFailed("Speichern fehlgeschlagen");
						return;
					}

					const updatePayload = { active: false };

					const { data: updateData, error: updateError } = await supabase
						.from("clients")
						.update(updatePayload)
						.eq("id", clientId)
						.select();

					if (updateError) {
						showSaveFailed("Speichern fehlgeschlagen");
						showError(`Update-Fehler: ${updateError.message}`);
						return;
					}

					if (!Array.isArray(updateData) || updateData.length === 0) {
						showSaveFailed("Speichern fehlgeschlagen");
						showError("Update lieferte keine geänderte Zeile zurück");
						return;
					}

					const { data: verifyRow, error: verifyError } = await supabase
						.from("clients")
						.select("*")
						.eq("id", clientId)
						.single();

					if (verifyError) {
						showSaveFailed("Speichern fehlgeschlagen");
						showError(`Verifikation-Fehler: ${verifyError.message}`);
						return;
					}

					const verified = Boolean(
						verifyRow &&
						verifyRow.active === false
					);

					if (verified) {
						hideError();
						markClientChangeSaved();
						await loadClients();
					} else {
						showSaveFailed("Speichern fehlgeschlagen");
						showError("Verifikation fehlgeschlagen: active stimmt nicht");
					}
				} catch (error) {
					showSaveFailed("Speichern fehlgeschlagen");
					showError(`Fehler: ${error.message}`);
				}
			})();
			return;
		}

		if (action === "payment-open") {
			runClientAction(clientId, "payment-open");
			return;
		}

		if (action === "payment-paid") {
			runClientAction(clientId, "payment-paid");
			return;
		}

		if (action === "details") {
			openDetails(clientId);
		}
	});

	dom.exportBtn.addEventListener("click", exportClientsJson);

	dom.closeModalBtn.addEventListener("click", closeDetails);
	dom.detailsModal.addEventListener("click", (event) => {
		if (event.target === dom.detailsModal) {
			closeDetails();
		}
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			closeDetails();
		}
	});
}

async function loadClients() {
	let rawClients;
	let rawEnvelope = null;
	let loadSource = "Demo";

	// 1. Versuche Supabase
	if (typeof isSupabaseConnected === 'function' && isSupabaseConnected() && typeof loadClientsFromSupabase === 'function') {
		try {
			const supabaseData = await loadClientsFromSupabase();
			
			if (supabaseData && Array.isArray(supabaseData) && supabaseData.length > 0) {
				state.supabaseConnected = true;
				rawClients = supabaseData;
				rawEnvelope = null;
				loadSource = "Supabase";
				hideError();
				dom.dataSourceState.textContent = "Datenquelle: Supabase (Online)";
				dom.connectionStatus.textContent = "✓ Online verbunden";
				dom.connectionStatus.style.color = "var(--ok)";
			} else {
				throw new Error("Supabase-Daten leer oder ungültig");
			}
		} catch (error) {
			state.supabaseConnected = false;
			loadSource = null;
			showError(`Supabase-Laden fehlgeschlagen: ${error.message}`);
		}
	} else {
		state.supabaseConnected = false;
		dom.connectionStatus.textContent = "⊗ Offline (Demo-Modus)";
		dom.connectionStatus.style.color = "var(--warn)";
	}

	// 2. Fallback: API laden (nur wenn Supabase nicht verbunden)
	if (!rawClients && !state.supabaseConnected) {
		try {
			const response = await fetch("/api/clients", {
				cache: "no-store",
				method: 'GET',
				headers: {
					'Accept': 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const payload = await response.json();

			rawEnvelope = Array.isArray(payload) ? null : payload;
			rawClients = Array.isArray(payload) ? payload : payload.clients;

			if (!Array.isArray(rawClients)) {
				throw new Error("Keine Daten vom API");
			}

			loadSource = "API";
			hideError();
			dom.dataSourceState.textContent = "Datenquelle: Express API";
			if (!dom.connectionStatus.textContent.includes("Online")) {
				dom.connectionStatus.textContent = "⊗ Offline Mode (Fallback)";
				dom.connectionStatus.style.color = "var(--warn)";
			}
		} catch {
			loadSource = null;
		}
	}

	// 3. Fallback: lokale clients.json
	if (!rawClients) {
		try {
			const fallbackResponse = await fetch("clients.json", { cache: "no-store" });
			if (fallbackResponse.ok) {
				const payload = await fallbackResponse.json();
				rawEnvelope = Array.isArray(payload) ? null : payload;
				rawClients = Array.isArray(payload) ? payload : payload.clients;
				loadSource = "Lokal";
				dom.dataSourceState.textContent = "Datenquelle: clients.json (lokal)";
			} else {
				throw new Error("clients.json nicht verfügbar");
			}
		} catch (fallbackError) {
			loadSource = null;
		}
	}

	// 4. Falls noch immer keine Daten: Demo-Daten
	if (!rawClients) {
		rawClients = fallbackClients;
		rawEnvelope = null;
		loadSource = "Demo";
		dom.dataSourceState.textContent = "Datenquelle: Demo-Daten (lokal)";
		showError(
			`Konnte Daten nicht laden. Es werden Demo-Daten angezeigt.`
		);
	}

	state.rawEnvelope = rawEnvelope ? cloneDeep(rawEnvelope) : null;
	state.rawClients = cloneDeep(rawClients);
	state.clients = rawClients.map(normalizeClient);

	if (rawClients.length > 0 && state.clients.length === 0) {
		showError('Clients wurden geladen, aber das Mapping fuer das Dashboard ist fehlgeschlagen.');
	}

	renderAll();
}

wireEvents();
renderLastChangeStatus();
window.setInterval(renderLastChangeStatus, 1000);
loadClients();
