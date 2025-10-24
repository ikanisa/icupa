export function IntakeForm() {
  return (
    <form
      aria-labelledby="intake-form-heading"
      className="intake-form"
      style={{
        display: "grid",
        gap: 16,
        background: "var(--panel-elev)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-2xl)",
        padding: 20,
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <label className="label" htmlFor="contact-name">
          Primary contact name
        </label>
        <input
          id="contact-name"
          name="contactName"
          required
          autoComplete="name"
          className="input"
          placeholder="Jordan Rivera"
        />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <label className="label" htmlFor="contact-email">
          Email
        </label>
        <input
          id="contact-email"
          name="contactEmail"
          type="email"
          required
          autoComplete="email"
          className="input"
          placeholder="jordan@organization.com"
        />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <label className="label" htmlFor="organization">
          Organization or group
        </label>
        <input
          id="organization"
          name="organization"
          className="input"
          placeholder="Rivera Collective"
        />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <label className="label" htmlFor="trip-intent">
          Desired trip focus
        </label>
        <select id="trip-intent" name="tripIntent" className="select" defaultValue="">
          <option value="" disabled>
            Select a focus area
          </option>
          <option value="conservation">Conservation & biodiversity</option>
          <option value="education">Educational exchange</option>
          <option value="regenerative">Regenerative hospitality</option>
          <option value="adventure">Adventure & wellness</option>
          <option value="corporate">Corporate retreat or offsite</option>
        </select>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <label className="label" htmlFor="trip-window">
          Preferred travel window
        </label>
        <input
          id="trip-window"
          name="tripWindow"
          type="text"
          className="input"
          placeholder="Late October or flexible"
        />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <label className="label" htmlFor="traveler-count">
          Approximate traveler count
        </label>
        <input
          id="traveler-count"
          name="travelerCount"
          type="number"
          min={1}
          className="input"
          placeholder="12"
        />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <label className="label" htmlFor="impact-notes">
          Impact priorities, accessibility notes, or required programming
        </label>
        <textarea
          id="impact-notes"
          name="impactNotes"
          className="textarea"
          placeholder="Highlight desired conservation partners, DEI requirements, or must-have experiences."
        />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <button type="submit" className="btn btn-primary">
          Submit intake request
        </button>
        <p className="subtle" style={{ margin: 0 }}>
          Operators respond within one business day with scheduling options.
        </p>
      </div>
    </form>
  );
}
