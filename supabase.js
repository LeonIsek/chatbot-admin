// Phase β.5 (2026-04-23): Supabase-Direct-Calls komplett entfernt.
// Admin-Panel kommuniziert jetzt ausschliesslich ueber Backend-API mit Admin-JWT.
// Ursache: der oeffentliche Supabase-Anon-Key war im Client-Bundle sichtbar → jeder
// Browser-Besucher konnte damit direkt auf die clients-Tabelle zugreifen (Tenant-Leak).
//
// Gleiche Funktionen-Signaturen wie vorher damit script.js unangetastet bleibt.
// window.__directSupabaseClient ist jetzt ein Proxy, die alte Supabase-Client-API
// (.from().select()/update()/eq()/single()) emuliert und Backend-Calls macht.

const BACKEND_URL = 'https://chatbot-widget-kaqe.onrender.com';
const ADMIN_TOKEN_KEY = 'chatbot_admin_token';

function getAdminToken() {
	return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

function hasValidAdminToken() {
	const token = getAdminToken();
	if (!token) return false;
	try {
		const payload = JSON.parse(atob(token.split('.')[1]));
		return payload.role === 'admin' && payload.exp * 1000 > Date.now();
	} catch {
		return false;
	}
}

async function adminFetch(path, { method = 'GET', body } = {}) {
	const token = getAdminToken();
	const headers = { 'Accept': 'application/json' };
	if (token) headers['Authorization'] = `Bearer ${token}`;
	if (body) headers['Content-Type'] = 'application/json';
	const res = await fetch(`${BACKEND_URL}${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined
	});
	if (!res.ok) {
		let msg = `HTTP ${res.status}`;
		try { const j = await res.json(); if (j && j.error) msg = j.error; } catch { /* ignore */ }
		throw new Error(msg);
	}
	return res.json();
}

function isSupabaseConfigured() {
	// "Configured" im neuen Sinne = Backend-URL + gueltiger Admin-JWT vorhanden
	return Boolean(BACKEND_URL && hasValidAdminToken());
}

function isSupabaseConnected() {
	return hasValidAdminToken();
}

function logSupabaseStatus() {
	// no-op im API-Modus — chatbot-admin UI zeigt Connection-Status anders an
}

function mapDatabaseClientToFrontend(client) {
	const normalizedStatus = client.status ?? (client.active ? 'aktiv' : 'inaktiv');
	const normalizedBusinessName = client.businessName ?? client.business_name;
	const normalizedOpeningHours = client.openingHours ?? client.opening_hours;
	const normalizedPrices = client.prices ?? client.pricing;
	const normalizedMonthlyPrice = client.monthlyPrice ?? client.monthly_price;
	const normalizedPaymentStatus = client.paymentStatus ?? client.payment_status;

	return {
		id: client.id,
		businessName: normalizedBusinessName,
		active: client.active,
		status: normalizedStatus,
		phone: client.phone,
		email: client.email,
		address: client.address,
		openingHours: normalizedOpeningHours,
		prices: normalizedPrices,
		monthlyPrice: normalizedMonthlyPrice,
		paymentStatus: normalizedPaymentStatus,
		note: client.note,
		website: client.website,
		tone: client.tone
	};
}

function validateMappedClients(clients) {
	if (!Array.isArray(clients)) {
		throw new Error('Mapping ist kein Array');
	}
	clients.forEach((client, index) => {
		if (!client || !client.id) throw new Error(`Client ${index + 1} hat keine gueltige id`);
		if (!client.businessName) throw new Error(`Client ${client.id} hat keinen gueltigen businessName`);
	});
	return clients;
}

async function getClients() {
	if (!isSupabaseConnected()) return null;
	const json = await adminFetch('/api/admin/clients');
	return Array.isArray(json.clients) ? json.clients : [];
}

function mapFrontendUpdatesToDatabase(updates) {
	const nextUpdates = {};
	if (Object.hasOwn(updates, 'paymentStatus')) nextUpdates.payment_status = updates.paymentStatus;
	if (Object.hasOwn(updates, 'active')) nextUpdates.active = updates.active;
	if (Object.hasOwn(updates, 'businessName')) nextUpdates.business_name = updates.businessName;
	if (Object.hasOwn(updates, 'openingHours')) nextUpdates.opening_hours = updates.openingHours;
	if (Object.hasOwn(updates, 'monthlyPrice')) nextUpdates.monthly_price = updates.monthlyPrice;
	// Pass-through fields (sind im Backend-Patch-Whitelist)
	['email', 'phone', 'address', 'website', 'tone', 'note', 'prices'].forEach((k) => {
		if (Object.hasOwn(updates, k)) nextUpdates[k] = updates[k];
	});
	return nextUpdates;
}

function valuesEqual(left, right) {
	if (typeof left === 'object' && left !== null) return JSON.stringify(left) === JSON.stringify(right);
	return left === right;
}

function verifyDatabaseRowMatchesPayload(databaseRow, updatePayload) {
	const entries = Object.entries(updatePayload);
	if (!entries.length) return { ok: false, reason: 'Update-Payload ist leer' };
	for (const [key, expectedValue] of entries) {
		const actualValue = databaseRow[key];
		if (!valuesEqual(actualValue, expectedValue)) {
			return { ok: false, reason: `Feld ${key} stimmt nicht. Erwartet: ${JSON.stringify(expectedValue)}, Ist: ${JSON.stringify(actualValue)}` };
		}
	}
	return { ok: true, reason: '' };
}

async function loadClientsFromSupabase() {
	try {
		const data = await getClients();
		if (!data) return null;
		return validateMappedClients(data.map(mapDatabaseClientToFrontend));
	} catch (error) {
		return null;
	}
}

async function saveClientToSupabase(clientId, updates) {
	if (!isSupabaseConnected()) {
		return { success: false, data: null, error: new Error('Admin-JWT fehlt oder abgelaufen'), policyBlocked: false, idMatched: false };
	}
	try {
		const databaseUpdates = mapFrontendUpdatesToDatabase(updates);
		const json = await adminFetch(`/api/admin/clients/${encodeURIComponent(clientId)}`, {
			method: 'PATCH',
			body: databaseUpdates
		});
		if (!json || !json.client) {
			return { success: false, data: null, error: new Error('Backend lieferte keinen client zurueck'), policyBlocked: false, idMatched: true };
		}
		return { success: true, data: [json.client], error: null, policyBlocked: false, idMatched: true };
	} catch (error) {
		const message = String(error.message || '').toLowerCase();
		const notFound = message.includes('nicht gefunden') || message.includes('http 404');
		return { success: false, data: null, error, policyBlocked: false, idMatched: !notFound };
	}
}

async function updateClientAndVerify(clientId, updates) {
	if (!isSupabaseConnected()) {
		return { success: false, error: new Error('Admin-JWT fehlt oder abgelaufen'), updateResponse: null, verifiedRow: null, comparisonOk: false };
	}
	try {
		const updatePayload = mapFrontendUpdatesToDatabase(updates);
		if (!Object.keys(updatePayload).length) {
			return { success: false, error: new Error('Leeres updatePayload wird nicht gespeichert'), updateResponse: null, verifiedRow: null, comparisonOk: false };
		}
		const json = await adminFetch(`/api/admin/clients/${encodeURIComponent(clientId)}`, {
			method: 'PATCH',
			body: updatePayload
		});
		if (!json || !json.client) {
			return { success: false, error: new Error('Update lieferte keine geaenderte Zeile zurueck'), updateResponse: null, verifiedRow: null, comparisonOk: false };
		}
		const comparison = verifyDatabaseRowMatchesPayload(json.client, updatePayload);
		if (!comparison.ok) {
			return { success: false, error: new Error(comparison.reason), updateResponse: [json.client], verifiedRow: json.client, comparisonOk: false };
		}
		return { success: true, error: null, updateResponse: [json.client], verifiedRow: mapDatabaseClientToFrontend(json.client), comparisonOk: true };
	} catch (error) {
		return { success: false, error, updateResponse: null, verifiedRow: null, comparisonOk: false };
	}
}

async function saveAllClientsToSupabase(clients) {
	if (!isSupabaseConnected()) return false;
	try {
		for (const client of clients) {
			const updates = mapFrontendUpdatesToDatabase({
				active: client.status === 'aktiv' ? true : client.active,
				businessName: client.businessName,
				phone: client.phone,
				email: client.email,
				address: client.address,
				openingHours: client.openingHours,
				prices: client.prices,
				monthlyPrice: client.monthlyPrice,
				paymentStatus: client.paymentStatus,
				note: client.note,
				website: client.website,
				tone: client.tone
			});
			await adminFetch(`/api/admin/clients/${encodeURIComponent(client.id)}`, { method: 'PATCH', body: updates });
		}
		return true;
	} catch {
		return false;
	}
}

// Proxy fuer window.__directSupabaseClient — emuliert die chain-Syntax `.from().update().eq().select()`
// die in script.js verwendet wird, routed aber alles durch Backend-API.
const directApiProxy = {
	from(table) {
		if (table !== 'clients') {
			// Andere Tables sind vom Admin aktuell nicht direkt berueht — defensiv ablehnen
			return {
				select: () => ({ eq: () => ({ single: async () => ({ data: null, error: new Error(`Table ${table} nicht via Admin-API verfuegbar`) }) }) }),
				update: () => ({ eq: () => ({ select: async () => ({ data: null, error: new Error(`Table ${table} nicht via Admin-API verfuegbar`) }) }) })
			};
		}
		return {
			select(_cols) {
				return {
					eq(_col, value) {
						return {
							async single() {
								try {
									const json = await adminFetch(`/api/admin/clients/${encodeURIComponent(value)}`);
									return { data: json.client || null, error: null };
								} catch (e) { return { data: null, error: e }; }
							},
							async maybeSingle() {
								try {
									const json = await adminFetch(`/api/admin/clients/${encodeURIComponent(value)}`);
									return { data: json.client || null, error: null };
								} catch (e) {
									if (String(e.message || '').includes('nicht gefunden')) return { data: null, error: null };
									return { data: null, error: e };
								}
							}
						};
					}
				};
			},
			update(payload) {
				return {
					eq(_col, value) {
						return {
							async select() {
								try {
									const json = await adminFetch(`/api/admin/clients/${encodeURIComponent(value)}`, { method: 'PATCH', body: payload });
									return { data: json.client ? [json.client] : [], error: null };
								} catch (e) { return { data: null, error: e }; }
							}
						};
					}
				};
			}
		};
	}
};

window.__directSupabaseClient = directApiProxy;

window.addEventListener('DOMContentLoaded', () => {
	logSupabaseStatus();
});
