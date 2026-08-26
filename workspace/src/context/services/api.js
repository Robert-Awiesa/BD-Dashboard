// src/context/services/api.js

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export const bdApi = {
  // Health check
  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return await handleResponse(response);
    } catch (err) {
      console.warn('API Health Check failed:', err.message);
      return { status: 'error', error: err.message };
    }
  },

  // Pipeline endpoints
  async getPipeline() {
    const response = await fetch(`${API_BASE_URL}/pipeline`);
    return handleResponse(response);
  },

  async addPipelineItem(itemData) {
    const response = await fetch(`${API_BASE_URL}/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemData),
    });
    return handleResponse(response);
  },

  async updatePipelineItem(id, itemData) {
    const response = await fetch(`${API_BASE_URL}/pipeline/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemData),
    });
    return handleResponse(response);
  },

  async deletePipelineItem(id) {
    const response = await fetch(`${API_BASE_URL}/pipeline/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  // Tenders & EOI endpoints
  async getTenders(filters = {}) {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    const query = params.toString();
    const response = await fetch(`${API_BASE_URL}/tenders${query ? `?${query}` : ''}`);
    return handleResponse(response);
  },


  async addTender(tenderData) {
    const response = await fetch(`${API_BASE_URL}/tenders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tenderData),
    });
    return handleResponse(response);
  },

  async updateTender(id, tenderData) {
    const response = await fetch(`${API_BASE_URL}/tenders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tenderData),
    });
    return handleResponse(response);
  },

  async deleteTender(id) {
    const response = await fetch(`${API_BASE_URL}/tenders/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  // Expression of Interest endpoints
  async getEois(filters = {}) {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    const query = params.toString();
    const response = await fetch(`${API_BASE_URL}/eois${query ? `?${query}` : ''}`);
    return handleResponse(response);
  },


  async addEoi(eoiData) {
    const response = await fetch(`${API_BASE_URL}/eois`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eoiData),
    });
    return handleResponse(response);
  },

  async updateEoi(id, eoiData) {
    const response = await fetch(`${API_BASE_URL}/eois/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eoiData),
    });
    return handleResponse(response);
  },

  async deleteEoi(id) {
    const response = await fetch(`${API_BASE_URL}/eois/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  // Two-step attachment: upload the file first, then the returned record (with
  // the stored URL) is merged back into the EOI via updateEoi.
  async uploadEoiAttachment(id, file) {
    const formData = new FormData();
    formData.append('attachment', file);
    const response = await fetch(`${API_BASE_URL}/eois/${id}/attachment`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(response);
  },


  // --- Tenders & EOI: deadline intelligence and the decision trail ---

  // The source image is required before the tender exists, so it uploads on
  // its own and the create payload carries the returned URL.
  async uploadTenderSourceImage(file) {
    const body = new FormData();
    body.append('sourceImage', file);
    const response = await fetch(`${API_BASE_URL}/tenders/source-image`, { method: 'POST', body });
    return handleResponse(response);
  },

  async getTenderMeta() {
    const response = await fetch(`${API_BASE_URL}/tenders/meta`);
    return handleResponse(response);
  },

  async getTenderStats() {
    const response = await fetch(`${API_BASE_URL}/tenders/stats`);
    return handleResponse(response);
  },

  // One list across tenders AND EOIs, soonest first.
  async getDeadlineRunway(withinDays = 60) {
    const response = await fetch(`${API_BASE_URL}/tenders/runway?withinDays=${withinDays}`);
    return handleResponse(response);
  },

  async getTenderOwners() {
    const response = await fetch(`${API_BASE_URL}/tenders/owners`);
    return handleResponse(response);
  },

  async getIssuingAuthorities() {
    const response = await fetch(`${API_BASE_URL}/tenders/authorities`);
    return handleResponse(response);
  },

  async getTender(id) {
    const response = await fetch(`${API_BASE_URL}/tenders/${id}`);
    return handleResponse(response);
  },

  // The bid that answered this tender, read through from Proposals.
  async getTenderProposals(id) {
    const response = await fetch(`${API_BASE_URL}/tenders/${id}/proposals`);
    return handleResponse(response);
  },

  async setTenderMilestoneDone(tenderId, milestoneId, done) {
    const response = await fetch(`${API_BASE_URL}/tenders/${tenderId}/milestones/${milestoneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done }),
    });
    return handleResponse(response);
  },

  async setTenderArchived(id, archived) {
    const response = await fetch(`${API_BASE_URL}/tenders/${id}/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    });
    return handleResponse(response);
  },

  async getEoi(id) {
    const response = await fetch(`${API_BASE_URL}/eois/${id}`);
    return handleResponse(response);
  },

  // Bid / no-bid. A Pass must carry a reason.
  async setEoiDecision(id, payload) {
    const response = await fetch(`${API_BASE_URL}/eois/${id}/decision`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  // Promote an EOI into a full tender, carrying its details over.
  async convertEoiToTender(id, overrides = {}) {
    const response = await fetch(`${API_BASE_URL}/eois/${id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overrides),
    });
    return handleResponse(response);
  },

  async setEoiArchived(id, archived) {
    const response = await fetch(`${API_BASE_URL}/eois/${id}/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    });
    return handleResponse(response);
  },


  // Prospecting Leads endpoints
  async getProspectingLeads() {
    const response = await fetch(`${API_BASE_URL}/prospecting`);
    return handleResponse(response);
  },

  async addProspectingLead(leadData) {
    const response = await fetch(`${API_BASE_URL}/prospecting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadData),
    });
    return handleResponse(response);
  },

  async bulkAddProspectingLeads(leadsArray) {
    const response = await fetch(`${API_BASE_URL}/prospecting/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadsArray),
    });
    return handleResponse(response);
  },

  async updateProspectingLead(id, leadData) {
    const response = await fetch(`${API_BASE_URL}/prospecting/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadData),
    });
    return handleResponse(response);
  },

  async deleteProspectingLead(id) {
    const response = await fetch(`${API_BASE_URL}/prospecting/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  // Cold Calls endpoints
  async getColdCalls() {
    const response = await fetch(`${API_BASE_URL}/cold-calls`);
    return handleResponse(response);
  },

  async addColdCall(callData) {
    const response = await fetch(`${API_BASE_URL}/cold-calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(callData),
    });
    return handleResponse(response);
  },

  async updateColdCall(id, callData) {
    const response = await fetch(`${API_BASE_URL}/cold-calls/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(callData),
    });
    return handleResponse(response);
  },

  async deleteColdCall(id) {
    const response = await fetch(`${API_BASE_URL}/cold-calls/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  async convertColdCallToProspectingLead(id, overrides = {}) {
    const response = await fetch(`${API_BASE_URL}/cold-calls/${id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overrides),
    });
    return handleResponse(response);
  },

  // Social Media & Content Engine endpoints
  async getSocialContent(filters = {}) {
    const params = new URLSearchParams();
    if (filters.platform) params.set('platform', filters.platform);
    if (filters.status) params.set('status', filters.status);
    const qs = params.toString();
    const response = await fetch(`${API_BASE_URL}/social-content${qs ? `?${qs}` : ''}`);
    return handleResponse(response);
  },

  async addSocialContent(entryData) {
    const response = await fetch(`${API_BASE_URL}/social-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entryData),
    });
    return handleResponse(response);
  },

  async updateSocialContent(id, entryData) {
    const response = await fetch(`${API_BASE_URL}/social-content/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entryData),
    });
    return handleResponse(response);
  },

  async deleteSocialContent(id) {
    const response = await fetch(`${API_BASE_URL}/social-content/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  async uploadScriptFile(file) {
    const formData = new FormData();
    formData.append('scriptFile', file);
    const response = await fetch(`${API_BASE_URL}/social-content/upload-script`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(response);
  },

  async uploadCoverImage(file) {
    const formData = new FormData();
    formData.append('coverImage', file);
    const response = await fetch(`${API_BASE_URL}/social-content/upload-cover`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(response);
  },

  // Campaigns & Performance Matrix endpoints
  async getCampaigns(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.platform) params.set('platform', filters.platform);
    const qs = params.toString();
    const response = await fetch(`${API_BASE_URL}/campaigns${qs ? `?${qs}` : ''}`);
    return handleResponse(response);
  },

  async getCampaign(id) {
    const response = await fetch(`${API_BASE_URL}/campaigns/${id}`);
    return handleResponse(response);
  },

  async addCampaign(campaignData) {
    const response = await fetch(`${API_BASE_URL}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaignData),
    });
    return handleResponse(response);
  },

  async updateCampaign(id, campaignData) {
    const response = await fetch(`${API_BASE_URL}/campaigns/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaignData),
    });
    return handleResponse(response);
  },

  async deleteCampaign(id) {
    const response = await fetch(`${API_BASE_URL}/campaigns/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  async saveCampaignPlatformMetrics(id, platform, metrics) {
    const response = await fetch(`${API_BASE_URL}/campaigns/${id}/metrics/${encodeURIComponent(platform)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metrics),
    });
    return handleResponse(response);
  },

  async saveCampaignInsights(id, insights) {
    const response = await fetch(`${API_BASE_URL}/campaigns/${id}/insights`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(insights),
    });
    return handleResponse(response);
  },

  async rescheduleCampaign(id, dates) {
    const response = await fetch(`${API_BASE_URL}/campaigns/${id}/reschedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dates),
    });
    return handleResponse(response);
  },

  // Email & SMS outreach campaign endpoints
  async getOutreachMeta() {
    const response = await fetch(`${API_BASE_URL}/outreach/meta`);
    return handleResponse(response);
  },

  async getOutreachStats(channel) {
    const qs = channel ? `?channel=${encodeURIComponent(channel)}` : '';
    const response = await fetch(`${API_BASE_URL}/outreach/stats${qs}`);
    return handleResponse(response);
  },

  async getOutreachCampaigns(filters = {}) {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    const query = params.toString();
    const response = await fetch(`${API_BASE_URL}/outreach${query ? `?${query}` : ''}`);
    return handleResponse(response);
  },

  async addOutreachCampaign(data) {
    const response = await fetch(`${API_BASE_URL}/outreach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async updateOutreachCampaign(id, data) {
    const response = await fetch(`${API_BASE_URL}/outreach/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async getOutreachCampaign(id) {
    const response = await fetch(`${API_BASE_URL}/outreach/${id}`);
    return handleResponse(response);
  },

  async setOutreachCampaignArchived(id, archived) {
    const response = await fetch(`${API_BASE_URL}/outreach/${id}/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    });
    return handleResponse(response);
  },

  async deleteOutreachCampaign(id) {
    const response = await fetch(`${API_BASE_URL}/outreach/${id}`, { method: 'DELETE' });
    return handleResponse(response);
  },

  async deleteOutreachRecipient(recipientId) {
    const response = await fetch(`${API_BASE_URL}/outreach/recipients/${recipientId}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  // Pull recipients straight from Prospecting Leads / Client contacts instead of
  // exporting to a spreadsheet and re-importing it.
  async importOutreachRecipients(campaignId, { leadIds = [], clientIds = [] }) {
    const response = await fetch(`${API_BASE_URL}/outreach/${campaignId}/recipients/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadIds, clientIds }),
    });
    return handleResponse(response);
  },

  async deleteOutreachBatch(campaignId, batchId) {
    const response = await fetch(`${API_BASE_URL}/outreach/${campaignId}/batches/${batchId}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  async getOutreachRecipients(campaignId, filters = {}) {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    const query = params.toString();
    const response = await fetch(`${API_BASE_URL}/outreach/${campaignId}/recipients${query ? `?${query}` : ''}`);
    return handleResponse(response);
  },

  async addOutreachRecipient(campaignId, data) {
    const response = await fetch(`${API_BASE_URL}/outreach/${campaignId}/recipients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async bulkAddOutreachRecipients(campaignId, rows) {
    const response = await fetch(`${API_BASE_URL}/outreach/${campaignId}/recipients/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    return handleResponse(response);
  },

  async updateOutreachRecipient(id, data) {
    const response = await fetch(`${API_BASE_URL}/outreach/recipients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async logOutreachBatch(campaignId, data) {
    const response = await fetch(`${API_BASE_URL}/outreach/${campaignId}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async saveOutreachBatchMetrics(campaignId, batchId, metrics) {
    const response = await fetch(`${API_BASE_URL}/outreach/${campaignId}/batches/${batchId}/metrics`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metrics),
    });
    return handleResponse(response);
  },

  // Unified reminder feed (campaigns + events + milestones)
  async getReminders(sourceType) {
    const qs = sourceType ? `?sourceType=${encodeURIComponent(sourceType)}` : '';
    const response = await fetch(`${API_BASE_URL}/reminders${qs}`);
    return handleResponse(response);
  },

  async evaluateReminders() {
    const response = await fetch(`${API_BASE_URL}/reminders/evaluate`, { method: 'POST' });
    return handleResponse(response);
  },

  async actionReminder(id) {
    const response = await fetch(`${API_BASE_URL}/reminders/${id}/action`, { method: 'POST' });
    return handleResponse(response);
  },

  // Events & Forums
  async getEvents(filters = {}) {
    const params = new URLSearchParams();
    if (filters.eventType) params.set('eventType', filters.eventType);
    const qs = params.toString();
    const response = await fetch(`${API_BASE_URL}/events${qs ? `?${qs}` : ''}`);
    return handleResponse(response);
  },

  async addEvent(data) {
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async updateEvent(id, data) {
    const response = await fetch(`${API_BASE_URL}/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async deleteEvent(id) {
    const response = await fetch(`${API_BASE_URL}/events/${id}`, { method: 'DELETE' });
    return handleResponse(response);
  },

  async toggleEventTask(eventId, taskId, completed) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
    return handleResponse(response);
  },

  async updateEventAttendee(eventId, attendeeId, updates) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/attendees/${attendeeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return handleResponse(response);
  },

  async saveEventMetrics(id, payload) {
    const response = await fetch(`${API_BASE_URL}/events/${id}/metrics`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  async convertEventLead(id, leadData) {
    const response = await fetch(`${API_BASE_URL}/events/${id}/convert-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadData),
    });
    return handleResponse(response);
  },

  // Team & stakeholder milestones
  // Everyone who has ever been set as the person recording something: the
  // registered Team Member milestones plus every name typed into the picker.
  async getTeamRoster() {
    const response = await fetch(`${API_BASE_URL}/team`);
    return handleResponse(response);
  },

  // Idempotent — the picker calls it whenever somebody types a name, so the
  // roster is shared instead of living in one browser's localStorage.
  async addTeamMember(name) {
    const response = await fetch(`${API_BASE_URL}/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return handleResponse(response);
  },

  async getMilestones(filters = {}) {
    const params = new URLSearchParams();
    if (filters.milestoneType) params.set('milestoneType', filters.milestoneType);
    // `client` scopes to one account's appreciation dates; `scope` keeps the
    // team culture board ('team') separate from client milestones ('client').
    if (filters.client) params.set('client', filters.client);
    if (filters.scope) params.set('scope', filters.scope);
    const qs = params.toString();
    const response = await fetch(`${API_BASE_URL}/milestones${qs ? `?${qs}` : ''}`);
    return handleResponse(response);
  },

  async addMilestone(data) {
    const response = await fetch(`${API_BASE_URL}/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async updateMilestone(id, data) {
    const response = await fetch(`${API_BASE_URL}/milestones/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async deleteMilestone(id) {
    const response = await fetch(`${API_BASE_URL}/milestones/${id}`, { method: 'DELETE' });
    return handleResponse(response);
  },

  // Flagship DG Annual Event
  async getDgEvents() {
    const response = await fetch(`${API_BASE_URL}/dg-event`);
    return handleResponse(response);
  },

  async addDgEvent(data) {
    const response = await fetch(`${API_BASE_URL}/dg-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async updateDgEvent(id, data) {
    const response = await fetch(`${API_BASE_URL}/dg-event/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async deleteDgEvent(id) {
    const response = await fetch(`${API_BASE_URL}/dg-event/${id}`, { method: 'DELETE' });
    return handleResponse(response);
  },

  // The stage manifest — activities and declared fields per stage — so the UI
  // renders from the server's spec instead of keeping a copy that drifts.
  async getDgMeta() {
    const response = await fetch(`${API_BASE_URL}/dg-event/meta`);
    return handleResponse(response);
  },

  async updateDgPhase(dgEventId, phaseId, updates) {
    const response = await fetch(`${API_BASE_URL}/dg-event/${dgEventId}/phases/${phaseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return handleResponse(response);
  },

  async setDgPhaseAttributes(dgEventId, phaseId, attributes) {
    const response = await fetch(`${API_BASE_URL}/dg-event/${dgEventId}/phases/${phaseId}/attributes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attributes),
    });
    return handleResponse(response);
  },

  async addDgPhaseExpense(dgEventId, phaseId, expense) {
    const response = await fetch(`${API_BASE_URL}/dg-event/${dgEventId}/phases/${phaseId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expense),
    });
    return handleResponse(response);
  },

  async deleteDgPhaseExpense(dgEventId, phaseId, expenseId) {
    const response = await fetch(
      `${API_BASE_URL}/dg-event/${dgEventId}/phases/${phaseId}/expenses/${expenseId}`,
      { method: 'DELETE' }
    );
    return handleResponse(response);
  },

  async addDgPhaseTask(id, phaseId, task) {
    const response = await fetch(`${API_BASE_URL}/dg-event/${id}/phases/${phaseId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    return handleResponse(response);
  },

  async updateDgPhaseTask(id, phaseId, taskId, updates) {
    const response = await fetch(`${API_BASE_URL}/dg-event/${id}/phases/${phaseId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return handleResponse(response);
  },

  async deleteDgPhaseTask(id, phaseId, taskId) {
    const response = await fetch(`${API_BASE_URL}/dg-event/${id}/phases/${phaseId}/tasks/${taskId}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  async submitDgProposal(id, proposal) {
    const response = await fetch(`${API_BASE_URL}/dg-event/${id}/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proposal),
    });
    return handleResponse(response);
  },

  // Media Hub — photos/audio uploaded locally, video attached as links
  async getMediaArchive() {
    const response = await fetch(`${API_BASE_URL}/media`);
    return handleResponse(response);
  },

  async uploadMediaFile(ownerType, ownerId, file, label = '') {
    const formData = new FormData();
    formData.append('mediaFile', file);
    if (label) formData.append('label', label);
    const response = await fetch(`${API_BASE_URL}/media/upload/${ownerType}/${ownerId}`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(response);
  },

  async addMediaLink(ownerType, ownerId, item) {
    const response = await fetch(`${API_BASE_URL}/media/link/${ownerType}/${ownerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return handleResponse(response);
  },

  async deleteMediaItem(ownerType, ownerId, mediaId) {
    const response = await fetch(`${API_BASE_URL}/media/${ownerType}/${ownerId}/${mediaId}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  async reviewDgProposal(id, proposalId, review) {
    const response = await fetch(`${API_BASE_URL}/dg-event/${id}/proposals/${proposalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review),
    });
    return handleResponse(response);
  },

  // ====================
  // Reports & Documentation hub
  // ====================

  // Enum/limit manifest, so the forms never drift from the Mongoose schema.
  async getDocumentMeta() {
    const response = await fetch(`${API_BASE_URL}/documents/meta`);
    return handleResponse(response);
  },

  async getDocuments(filters = {}) {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    const query = params.toString();
    const response = await fetch(`${API_BASE_URL}/documents${query ? `?${query}` : ''}`);
    return handleResponse(response);
  },

  async getDocument(id) {
    const response = await fetch(`${API_BASE_URL}/documents/${id}`);
    return handleResponse(response);
  },

  async getDocumentStats() {
    const response = await fetch(`${API_BASE_URL}/documents/stats`);
    return handleResponse(response);
  },

  // Known team members, so the active-member picker offers real names rather
  // than a free-text box that fragments attribution.
  async getDocumentAuthors() {
    const response = await fetch(`${API_BASE_URL}/documents/authors`);
    return handleResponse(response);
  },

  async getDocumentTags(category) {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    const response = await fetch(`${API_BASE_URL}/documents/tags${query}`);
    return handleResponse(response);
  },

  // Two-step upload: store the file first so the dropzone can show it as
  // attached while the rest of the metadata form is still being filled in.
  async uploadDocumentFile(file) {
    const formData = new FormData();
    formData.append('documentFile', file);
    const response = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(response);
  },

  async addDocument(data) {
    const response = await fetch(`${API_BASE_URL}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async updateDocument(id, data) {
    const response = await fetch(`${API_BASE_URL}/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  // Supersede the live file/memo; the previous state moves into versionHistory.
  async addDocumentVersion(id, data) {
    const response = await fetch(`${API_BASE_URL}/documents/${id}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async setDocumentArchived(id, archived) {
    const response = await fetch(`${API_BASE_URL}/documents/${id}/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    });
    return handleResponse(response);
  },

  async deleteDocument(id) {
    const response = await fetch(`${API_BASE_URL}/documents/${id}`, { method: 'DELETE' });
    return handleResponse(response);
  },

  async recordDocumentView(id, viewer) {
    const response = await fetch(`${API_BASE_URL}/documents/${id}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewer }),
    });
    return handleResponse(response);
  },

  async recordDocumentDownload(id, viewer) {
    const response = await fetch(`${API_BASE_URL}/documents/${id}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewer }),
    });
    return handleResponse(response);
  },

  async addDocumentComment(id, comment) {
    const response = await fetch(`${API_BASE_URL}/documents/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comment),
    });
    return handleResponse(response);
  },

  async deleteDocumentComment(id, commentId) {
    const response = await fetch(`${API_BASE_URL}/documents/${id}/comments/${commentId}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  // ====================
  // Blog & Content CMS
  // ====================

  async getContentMeta() {
    const response = await fetch(`${API_BASE_URL}/content/meta`);
    return handleResponse(response);
  },

  async getContentList(filters = {}) {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    const query = params.toString();
    const response = await fetch(`${API_BASE_URL}/content${query ? `?${query}` : ''}`);
    return handleResponse(response);
  },

  async getContentItem(id) {
    const response = await fetch(`${API_BASE_URL}/content/${id}`);
    return handleResponse(response);
  },

  async getContentStats() {
    const response = await fetch(`${API_BASE_URL}/content/stats`);
    return handleResponse(response);
  },

  async getContentTags(contentType) {
    const query = contentType ? `?contentType=${encodeURIComponent(contentType)}` : '';
    const response = await fetch(`${API_BASE_URL}/content/tags${query}`);
    return handleResponse(response);
  },

  async getContentSectors() {
    const response = await fetch(`${API_BASE_URL}/content/sectors`);
    return handleResponse(response);
  },

  async getContentAuthors() {
    const response = await fetch(`${API_BASE_URL}/content/authors`);
    return handleResponse(response);
  },

  // The asset library, for cover-image and client-logo pickers.
  async getAssetLibrary() {
    const response = await fetch(`${API_BASE_URL}/content/assets`);
    return handleResponse(response);
  },

  async uploadAssetFile(file) {
    const formData = new FormData();
    formData.append('assetFile', file);
    const response = await fetch(`${API_BASE_URL}/content/upload`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(response);
  },

  async addContent(data) {
    const response = await fetch(`${API_BASE_URL}/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async updateContent(id, data) {
    const response = await fetch(`${API_BASE_URL}/content/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async setContentArchived(id, archived) {
    const response = await fetch(`${API_BASE_URL}/content/${id}/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    });
    return handleResponse(response);
  },

  async deleteContent(id) {
    const response = await fetch(`${API_BASE_URL}/content/${id}`, { method: 'DELETE' });
    return handleResponse(response);
  },

  async recordContentView(id, actor) {
    const response = await fetch(`${API_BASE_URL}/content/${id}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor }),
    });
    return handleResponse(response);
  },

  // Bumped when collateral actually gets used — asset downloaded, FAQ answer
  // copied for a call, story link pulled into a proposal.
  async recordContentUsage(id, actor) {
    const response = await fetch(`${API_BASE_URL}/content/${id}/use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor }),
    });
    return handleResponse(response);
  },

  // ====================
  // Client Relations
  // ====================

  async getClientMeta() {
    const response = await fetch(`${API_BASE_URL}/clients/meta`);
    return handleResponse(response);
  },

  async getClients(filters = {}) {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    const query = params.toString();
    const response = await fetch(`${API_BASE_URL}/clients${query ? `?${query}` : ''}`);
    return handleResponse(response);
  },

  async getClient(id) {
    const response = await fetch(`${API_BASE_URL}/clients/${id}`);
    return handleResponse(response);
  },

  // Portfolio health: totals, the needs-attention queue and renewal runway.
  async getClientStats() {
    const response = await fetch(`${API_BASE_URL}/clients/stats`);
    return handleResponse(response);
  },

  async getClientOwners() {
    const response = await fetch(`${API_BASE_URL}/clients/owners`);
    return handleResponse(response);
  },

  async getClientSectors() {
    const response = await fetch(`${API_BASE_URL}/clients/sectors`);
    return handleResponse(response);
  },

  async addClient(data) {
    const response = await fetch(`${API_BASE_URL}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async updateClient(id, data) {
    const response = await fetch(`${API_BASE_URL}/clients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async setClientArchived(id, archived) {
    const response = await fetch(`${API_BASE_URL}/clients/${id}/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    });
    return handleResponse(response);
  },

  async deleteClient(id) {
    const response = await fetch(`${API_BASE_URL}/clients/${id}`, { method: 'DELETE' });
    return handleResponse(response);
  },

  // Promote a won pipeline deal into an ongoing relationship.
  async convertPipelineItemToClient(pipelineId, overrides = {}) {
    const response = await fetch(`${API_BASE_URL}/clients/convert/${pipelineId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overrides),
    });
    return handleResponse(response);
  },

  // --- Interactions (the team activity feed) ---
  async getInteractions(filters = {}) {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    const query = params.toString();
    const response = await fetch(`${API_BASE_URL}/clients/interactions${query ? `?${query}` : ''}`);
    return handleResponse(response);
  },

  async logInteraction(data) {
    const response = await fetch(`${API_BASE_URL}/clients/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async deleteInteraction(id) {
    const response = await fetch(`${API_BASE_URL}/clients/interactions/${id}`, { method: 'DELETE' });
    return handleResponse(response);
  },

  // --- Commitments ---
  async addCommitment(clientId, data) {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/commitments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async setCommitmentDone(clientId, commitmentId, completed) {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/commitments/${commitmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
    return handleResponse(response);
  },

  async deleteCommitment(clientId, commitmentId) {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/commitments/${commitmentId}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  // --- Satisfaction (Sati-Survey) ---
  async recordClientSurvey(clientId, data) {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/surveys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async deleteClientSurvey(clientId, surveyId) {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/surveys/${surveyId}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  // ====================
  // Field Visits
  // A visit-centric view over the same Interaction records the client timeline
  // reads, so a site visit never falls out of the client's history.
  // ====================

  async getFieldVisitMeta() {
    const response = await fetch(`${API_BASE_URL}/field-visits/meta`);
    return handleResponse(response);
  },

  async getFieldVisits(filters = {}) {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    const query = params.toString();
    const response = await fetch(`${API_BASE_URL}/field-visits${query ? `?${query}` : ''}`);
    return handleResponse(response);
  },

  async getFieldVisit(id) {
    const response = await fetch(`${API_BASE_URL}/field-visits/${id}`);
    return handleResponse(response);
  },

  async getFieldVisitStats() {
    const response = await fetch(`${API_BASE_URL}/field-visits/stats`);
    return handleResponse(response);
  },

  async addFieldVisit(data) {
    const response = await fetch(`${API_BASE_URL}/field-visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async updateFieldVisit(id, data) {
    const response = await fetch(`${API_BASE_URL}/field-visits/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  // Turn a planned visit into a completed one and file the report together.
  async completeFieldVisit(id, data) {
    const response = await fetch(`${API_BASE_URL}/field-visits/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async deleteFieldVisit(id) {
    const response = await fetch(`${API_BASE_URL}/field-visits/${id}`, { method: 'DELETE' });
    return handleResponse(response);
  },

  async uploadVisitPhoto(id, file, caption = '') {
    const formData = new FormData();
    formData.append('photo', file);
    if (caption) formData.append('caption', caption);
    const response = await fetch(`${API_BASE_URL}/field-visits/${id}/photos`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(response);
  },

  async deleteVisitPhoto(id, photoId) {
    const response = await fetch(`${API_BASE_URL}/field-visits/${id}/photos/${photoId}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  // ====================
  // Tasks & Projects
  // Owns standalone work; borrowed items are read through from the module that
  // owns them and written back to that module's own endpoint.
  // ====================

  async getTaskMeta() {
    const response = await fetch(`${API_BASE_URL}/tasks/meta`);
    return handleResponse(response);
  },

  // The one list: standalone tasks plus every borrowed obligation.
  async getMyWork(filters = {}) {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    const query = params.toString();
    const response = await fetch(`${API_BASE_URL}/tasks/my-work${query ? `?${query}` : ''}`);
    return handleResponse(response);
  },

  async getWorkStats(owner) {
    const query = owner ? `?owner=${encodeURIComponent(owner)}` : '';
    const response = await fetch(`${API_BASE_URL}/tasks/stats${query}`);
    return handleResponse(response);
  },

  async getWorkOwners() {
    const response = await fetch(`${API_BASE_URL}/tasks/owners`);
    return handleResponse(response);
  },

  async getTasks(filters = {}) {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    const query = params.toString();
    const response = await fetch(`${API_BASE_URL}/tasks${query ? `?${query}` : ''}`);
    return handleResponse(response);
  },

  async addTask(data) {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async updateTask(id, data) {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async deleteTask(id) {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, { method: 'DELETE' });
    return handleResponse(response);
  },

  async getProjects(filters = {}) {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    const query = params.toString();
    const response = await fetch(`${API_BASE_URL}/tasks/projects${query ? `?${query}` : ''}`);
    return handleResponse(response);
  },

  async addProject(data) {
    const response = await fetch(`${API_BASE_URL}/tasks/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async updateProject(id, data) {
    const response = await fetch(`${API_BASE_URL}/tasks/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async deleteProject(id) {
    const response = await fetch(`${API_BASE_URL}/tasks/projects/${id}`, { method: 'DELETE' });
    return handleResponse(response);
  },

  // ====================
  // Proposals — client-facing bids
  // (distinct from DgEvent.proposals, which are internal session/budget ideas)
  // ====================

  async getProposalMeta() {
    const response = await fetch(`${API_BASE_URL}/proposals/meta`);
    return handleResponse(response);
  },

  // --- Partner directory: who we work with, what they offer, how to reach them ---
  async getPartners(filters = {}) {
    const qs = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined)
    ).toString();
    const response = await fetch(`${API_BASE_URL}/partners${qs ? `?${qs}` : ''}`);
    return handleResponse(response);
  },

  async addPartner(data) {
    const response = await fetch(`${API_BASE_URL}/partners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async updatePartner(id, data) {
    const response = await fetch(`${API_BASE_URL}/partners/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async setPartnerArchived(id, archived) {
    const response = await fetch(`${API_BASE_URL}/partners/${id}/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    });
    return handleResponse(response);
  },

  async deletePartner(id) {
    const response = await fetch(`${API_BASE_URL}/partners/${id}`, { method: 'DELETE' });
    return handleResponse(response);
  },

  async getPartnerOwners() {
    const response = await fetch(`${API_BASE_URL}/partners/owners`);
    return handleResponse(response);
  },

  async getProposals(filters = {}) {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    const query = params.toString();
    const response = await fetch(`${API_BASE_URL}/proposals${query ? `?${query}` : ''}`);
    return handleResponse(response);
  },

  async getProposal(id) {
    const response = await fetch(`${API_BASE_URL}/proposals/${id}`);
    return handleResponse(response);
  },

  async getProposalStats() {
    const response = await fetch(`${API_BASE_URL}/proposals/stats`);
    return handleResponse(response);
  },

  async getProposalOwners() {
    const response = await fetch(`${API_BASE_URL}/proposals/owners`);
    return handleResponse(response);
  },

  async getProposalSectors() {
    const response = await fetch(`${API_BASE_URL}/proposals/sectors`);
    return handleResponse(response);
  },

  async addProposal(data) {
    const response = await fetch(`${API_BASE_URL}/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async updateProposal(id, data) {
    const response = await fetch(`${API_BASE_URL}/proposals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  // Moving stage carries the outcome rules — a loss is refused without a reason.
  async setProposalStage(id, data) {
    const response = await fetch(`${API_BASE_URL}/proposals/${id}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  async setProposalArchived(id, archived) {
    const response = await fetch(`${API_BASE_URL}/proposals/${id}/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    });
    return handleResponse(response);
  },

  async deleteProposal(id) {
    const response = await fetch(`${API_BASE_URL}/proposals/${id}`, { method: 'DELETE' });
    return handleResponse(response);
  },

  async addProposalChecklistItem(id, item) {
    const response = await fetch(`${API_BASE_URL}/proposals/${id}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return handleResponse(response);
  },

  async setProposalChecklistDone(id, itemId, completed) {
    const response = await fetch(`${API_BASE_URL}/proposals/${id}/checklist/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
    return handleResponse(response);
  },

  async deleteProposalChecklistItem(id, itemId) {
    const response = await fetch(`${API_BASE_URL}/proposals/${id}/checklist/${itemId}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  // Logging a chase resets the silence clock that drives "gone cold".
  async addProposalFollowUp(id, followUp) {
    const response = await fetch(`${API_BASE_URL}/proposals/${id}/follow-ups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(followUp),
    });
    return handleResponse(response);
  },

  async deleteProposalFollowUp(id, followUpId) {
    const response = await fetch(`${API_BASE_URL}/proposals/${id}/follow-ups/${followUpId}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  /**
   * Tick a work item off wherever it actually lives.
   *
   * This is the write half of the read-through mirror: Tasks never stores a
   * copy of borrowed work, so completing it has to route back to the module
   * that owns it. `origin.type` comes from the my-work payload.
   */
  async setWorkItemDone(origin, done) {
    switch (origin.type) {
      case 'task':
        return this.updateTask(origin.id, { status: done ? 'Done' : 'To Do' });
      case 'event':
        return this.toggleEventTask(origin.id, origin.itemId, done);
      case 'client':
        return this.setCommitmentDone(origin.id, origin.itemId, done);
      case 'dgEvent':
        return this.updateDgPhaseTask(origin.id, origin.phaseId, origin.itemId, { completed: done });
      case 'proposal':
        return this.setProposalChecklistDone(origin.id, origin.itemId, done);
      default:
        throw new Error(`Unknown work item source "${origin.type}"`);
    }
  },
};
