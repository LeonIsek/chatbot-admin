const SUPABASE_URL = "lzvmtctyzicdtgtoevaf";
const SUPABASE_ANON_KEY = "sb_publishable_p_JbsG1bB7f-zWossrLETA_Pe_0W19o";

function resolveSupabaseUrl(value) {
	const rawValue = String(value || "").trim();
	if (!rawValue) {
		return "";
	}

	if (rawValue.startsWith("http://") || rawValue.startsWith("https://")) {
		return rawValue;
	}

	return `https://${rawValue}.supabase.co`;
}

const resolvedSupabaseUrl = resolveSupabaseUrl(SUPABASE_URL);

const supabaseClient =
	typeof window.supabase !== "undefined" && resolvedSupabaseUrl && SUPABASE_ANON_KEY
		? window.supabase.createClient(resolvedSupabaseUrl, SUPABASE_ANON_KEY)
		: null;

window.__directSupabaseClient = supabaseClient;

function isSupabaseConfigured() {
	return Boolean(resolvedSupabaseUrl && SUPABASE_ANON_KEY);
}

function isSupabaseConnected() {
	return Boolean(supabaseClient);
}

function logSupabaseStatus() {
	if (!isSupabaseConfigured()) {
		return;
	}

	if (!supabaseClient) {
		return;
	}
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
		throw new Error('Supabase-Mapping ist kein Array');
	}

	clients.forEach((client, index) => {
		if (!client || !client.id) {
			throw new Error(`Client ${index + 1} hat keine gueltige id`);
		}

		if (!client.businessName) {
			throw new Error(`Client ${client.id} hat keinen gueltigen businessName`);
		}
	});

	return clients;
}

async function getClients() {
	if (!isSupabaseConnected()) {
		return null;
	}

	const { data, error } = await supabaseClient
		.from('clients')
		.select('*');

	if (error) {
		throw error;
	}

	return data;
}

function mapFrontendUpdatesToDatabase(updates) {
	const nextUpdates = {};

	if (Object.hasOwn(updates, 'paymentStatus')) {
		nextUpdates.payment_status = updates.paymentStatus;
	}

	if (Object.hasOwn(updates, 'active')) {
		nextUpdates.active = updates.active;
	}

	return nextUpdates;
}

function valuesEqual(left, right) {
	if (typeof left === 'object' && left !== null) {
		return JSON.stringify(left) === JSON.stringify(right);
	}

	return left === right;
}

function verifyDatabaseRowMatchesPayload(databaseRow, updatePayload) {
	const entries = Object.entries(updatePayload);
	if (!entries.length) {
		return { ok: false, reason: 'Update-Payload ist leer' };
	}

	for (const [key, expectedValue] of entries) {
		const actualValue = databaseRow[key];
		if (!valuesEqual(actualValue, expectedValue)) {
			return {
				ok: false,
				reason: `Feld ${key} stimmt nicht. Erwartet: ${JSON.stringify(expectedValue)}, Ist: ${JSON.stringify(actualValue)}`
			};
		}
	}

	return { ok: true, reason: '' };
}

function mapFrontendClientToDatabase(client) {
	return {
		id: client.id,
		active: client.status === 'aktiv',
		business_name: client.businessName,
		phone: client.phone,
		email: client.email,
		address: client.address,
		opening_hours: client.openingHours,
		prices: client.prices,
		monthly_price: client.monthlyPrice,
		payment_status: client.paymentStatus,
		note: client.note,
		website: client.website,
		tone: client.tone
	};
}

/**
 * Lade alle Clients von Supabase
 * Fallback: lokale clients.json wenn nicht verbunden
 */
async function loadClientsFromSupabase() {
	try {
		const data = await getClients();
		const mappedClients = validateMappedClients(data.map(mapDatabaseClientToFrontend));
		return mappedClients;
	} catch (error) {
		return null;
	}
}

/**
 * Speichere einen einzelnen Client
 */
async function saveClientToSupabase(clientId, updates) {
	if (!isSupabaseConnected()) {
		return {
			success: false,
			data: null,
			error: new Error('Supabase nicht verbunden'),
			policyBlocked: false,
			idMatched: false
		};
	}

	try {
		const databaseUpdates = mapFrontendUpdatesToDatabase(updates);

		const { data: existingRow, error: existingRowError } = await supabaseClient
			.from('clients')
			.select('id')
			.eq('id', clientId)
			.maybeSingle();

		if (existingRowError) {
			throw existingRowError;
		}

		if (!existingRow) {
			return {
				success: false,
				data: null,
				error: new Error(`Client mit id ${clientId} wurde in Supabase nicht gefunden`),
				policyBlocked: false,
				idMatched: false
			};
		}

		const { data, error } = await supabaseClient
			.from('clients')
			.update(databaseUpdates)
			.eq('id', clientId)
			.select();

		if (error) {
			throw error;
		}

		if (!Array.isArray(data) || data.length === 0) {
			return {
				success: false,
				data,
				error: new Error('Update wurde nicht bestaetigt. Moeglich: Supabase Policy blockiert das Update.'),
				policyBlocked: true,
				idMatched: true
			};
		}

		return {
			success: true,
			data,
			error: null,
			policyBlocked: false,
			idMatched: true
		};
	} catch (error) {
		const message = String(error.message || '').toLowerCase();
		const policyBlocked =
			message.includes('row-level security') ||
			message.includes('permission denied') ||
			message.includes('not allowed') ||
			message.includes('policy');

		return {
			success: false,
			data: null,
			error,
			policyBlocked,
			idMatched: true
		};
	}
}

async function updateClientAndVerify(clientId, updates) {
	if (!isSupabaseConnected()) {
		return {
			success: false,
			error: new Error('Supabase nicht verbunden'),
			updateResponse: null,
			verifiedRow: null,
			comparisonOk: false
		};
	}

	try {
		const updatePayload = mapFrontendUpdatesToDatabase(updates);
		if (!Object.keys(updatePayload).length) {
			return {
				success: false,
				error: new Error('Leeres updatePayload wird nicht gespeichert'),
				updateResponse: null,
				verifiedRow: null,
				comparisonOk: false
			};
		}

		const { data: updateData, error: updateError } = await supabaseClient
			.from('clients')
			.update(updatePayload)
			.eq('id', clientId)
			.select();

		if (updateError) {
			throw updateError;
		}

		if (!Array.isArray(updateData) || updateData.length === 0) {
			return {
				success: false,
				error: new Error('Update lieferte keine geaenderte Zeile zurueck'),
				updateResponse: updateData,
				verifiedRow: null,
				comparisonOk: false
			};
		}

		const { data: verifyRow, error: verifyError } = await supabaseClient
			.from('clients')
			.select('*')
			.eq('id', clientId)
			.single();

		if (verifyError) {
			throw verifyError;
		}

		const comparison = verifyDatabaseRowMatchesPayload(verifyRow, updatePayload);

		if (!comparison.ok) {
			return {
				success: false,
				error: new Error(comparison.reason),
				updateResponse: updateData,
				verifiedRow: verifyRow,
				comparisonOk: false
			};
		}

		return {
			success: true,
			error: null,
			updateResponse: updateData,
			verifiedRow: mapDatabaseClientToFrontend(verifyRow),
			comparisonOk: true
		};
	} catch (error) {
		return {
			success: false,
			error,
			updateResponse: null,
			verifiedRow: null,
			comparisonOk: false
		};
	}
}

/**
 * Speichere alle Clients (für Batch-Update)
 */
async function saveAllClientsToSupabase(clients) {
	if (!isSupabaseConnected()) {
		return false;
	}

	try {
		// Upsert jeden Client
		for (const client of clients) {
			const databaseClient = mapFrontendClientToDatabase(client);
			const { error } = await supabaseClient
				.from('clients')
				.upsert(databaseClient, { onConflict: 'id' });

			if (error) {
				throw error;
			}
		}

		return true;
	} catch (error) {
		return false;
	}
}

window.addEventListener('DOMContentLoaded', () => {
	logSupabaseStatus();
});
