from rendercv.schema.yaml_reader import read_yaml
from rendercv.web.models import ValidateRequest
from rendercv.web.pdf_importer import convert_text_to_yaml
from rendercv.web.service import validate_web_request


def test_convert_text_to_yaml_builds_editable_rendercv_yaml() -> None:
    text = """
John Doe
Senior Software Engineer
john@example.com | +1 415 555 2671 | https://johndoe.dev
https://linkedin.com/in/johndoe
Experience
Acme Corp
Built internal tools and reduced deployment time.
Education
State University
BS Computer Science
Skills
Python, TypeScript, SQL
"""

    result = convert_text_to_yaml(text)
    data = read_yaml(result.yaml)

    assert data["cv"]["name"] == "John Doe"
    assert data["cv"]["email"] == "john@example.com"
    assert data["cv"]["phone"] == "+1 415-555-2671"
    assert data["cv"]["website"] == "https://johndoe.dev"
    assert data["cv"]["social_networks"][0]["network"] == "LinkedIn"
    assert data["cv"]["social_networks"][0]["username"] == "johndoe"
    assert "Experience" in data["cv"]["sections"]
    assert "Education" in data["cv"]["sections"]
    assert "Skills" in data["cv"]["sections"]
    assert result.line_count > 0
    assert "email" in result.detected_fields
    assert "phone" in result.detected_fields
    assert "section:Experience" in result.detected_fields
    assert result.warnings == []
    validate_web_request(ValidateRequest(main_yaml=result.yaml), max_yaml_bytes=500_000)


def test_convert_text_to_yaml_structures_common_cv_sections() -> None:
    text = """
Douglas Sejas Gamez
Mechanical Engineer
La Paz, Bolivia
douglassejas@gmail.com | +591 72738731 | github.com/DravenDou
LinkedIn: douglassejas
Profile
Full Stack & AI Developer at **Aipraxia**: I build web applications and AI features.
Stack: React/Next.js, TypeScript/Node.js, Python/FastAPI, PostgreSQL.
Experience
Aipraxia
Full Stack & AI Developer
2024 - present
Built internal tools and automation features.
Education
Universidad Mayor de San Andres
BS Computer Science
2020
Skills
React, Next.js, TypeScript, Python, FastAPI, PostgreSQL
Projects
AI Agent Platform for WhatsApp Customer Support
Built a WhatsApp AI assistant for a Bolivian bus ticketing company to automate customer
support and booking-related conversations.
Internal Dashboard
Reduced reporting time.
"""

    result = convert_text_to_yaml(text)
    data = read_yaml(result.yaml)

    assert data["cv"]["name"] == "Douglas Sejas Gamez"
    assert data["cv"]["headline"] == "Mechanical Engineer"
    assert data["cv"]["location"] == "La Paz, Bolivia"
    assert data["cv"]["phone"] == "+591 72738731"
    assert data["cv"]["social_networks"][0]["username"] == "douglassejas"
    assert data["cv"]["social_networks"][1]["username"] == "DravenDou"

    profile_entries = data["cv"]["sections"]["Profile"]
    assert len(profile_entries) == 1
    assert "Stack: React/Next.js" in profile_entries[0]

    experience_entry = data["cv"]["sections"]["Experience"][0]
    assert experience_entry["company"] == "Aipraxia"
    assert experience_entry["position"] == "Full Stack & AI Developer"
    assert experience_entry["start_date"] == "2024"
    assert experience_entry["end_date"] == "present"

    education_entry = data["cv"]["sections"]["Education"][0]
    assert education_entry["institution"] == "Universidad Mayor de San Andres"
    assert education_entry["degree"] == "BS"
    assert education_entry["area"] == "Computer Science"

    skills_entry = data["cv"]["sections"]["Skills"][0]
    assert skills_entry["label"] == "Skills"
    assert "Python" in skills_entry["details"]

    project_entries = data["cv"]["sections"]["Projects"]
    assert len(project_entries) == 2
    assert project_entries[0]["name"] == "AI Agent Platform for WhatsApp Customer Support"
    assert project_entries[0]["highlights"] == [
        (
            "Built a WhatsApp AI assistant for a Bolivian bus ticketing company "
            "to automate customer support and booking-related conversations."
        )
    ]
    assert project_entries[1]["name"] == "Internal Dashboard"

    assert "location" in result.detected_fields
    assert "social_networks" in result.detected_fields
    assert "section:Experience" in result.detected_fields
    validate_web_request(ValidateRequest(main_yaml=result.yaml), max_yaml_bytes=500_000)


def test_convert_text_to_yaml_returns_import_review_warnings() -> None:
    text = """
Jane Example
Product Designer
Portfolio: https://jane.example.com
COMMUNITY WORK
Organized design workshops for local students.
Custom Label: Something useful
"""

    result = convert_text_to_yaml(text)

    assert "No se detectó correo electrónico." in result.warnings
    assert "No se detectó teléfono válido con código de país." in result.warnings
    assert "Hay líneas dudosas que conviene revisar antes de exportar el CV." in result.warnings
    assert "name" in result.detected_fields
    assert "headline" in result.detected_fields
    assert "COMMUNITY WORK" in result.unrecognized_lines
    assert "Custom Label: Something useful" in result.unrecognized_lines
