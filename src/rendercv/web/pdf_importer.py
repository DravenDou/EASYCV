import io
import re
from dataclasses import dataclass

import phonenumbers
from pypdf import PdfReader
from ruamel.yaml import YAML

from rendercv.exception import RenderCVUserError

common_section_titles: dict[str, str] = {
    "about": "Profile",
    "awards": "Awards",
    "career objective": "Profile",
    "certifications": "Certifications",
    "courses": "Certifications",
    "education": "Education",
    "educación": "Educación",
    "employment": "Experience",
    "experience": "Experience",
    "experiencia": "Experiencia",
    "habilidades": "Habilidades",
    "honors": "Honors",
    "languages": "Languages",
    "objective": "Profile",
    "perfil": "Perfil",
    "professional experience": "Experience",
    "profile": "Profile",
    "project experience": "Projects",
    "projects": "Projects",
    "proyectos": "Proyectos",
    "publications": "Publications",
    "publicaciones": "Publicaciones",
    "research": "Research",
    "resumen": "Resumen",
    "skills": "Skills",
    "summary": "Summary",
}

known_label_names: frozenset[str] = frozenset(
    {
        "area",
        "authors",
        "cargo",
        "company",
        "date",
        "degree",
        "education",
        "email",
        "empresa",
        "fecha",
        "field",
        "github",
        "institution",
        "institución",
        "linkedin",
        "location",
        "lugar",
        "major",
        "name",
        "nombre",
        "organization",
        "organización",
        "phone",
        "position",
        "role",
        "school",
        "summary",
        "title",
        "título",
        "university",
        "url",
        "website",
        "ubicación",
        "ubicacion",
    }
)

email_pattern = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
phone_pattern = re.compile(r"(?:\+?\d[\d\s().-]{7,}\d)")
url_pattern = re.compile(
    r"(?:https?://|www\.|(?:linkedin|github)\.com/)[^\s<>]+",
    re.I,
)
linkedin_pattern = re.compile(
    r"(?:linkedin\.com/in/|linkedin[:\s]+)([A-Za-z0-9_.-]+)",
    re.I,
)
github_pattern = re.compile(
    r"(?:github\.com/|github[:\s]+)([A-Za-z0-9_.-]+)",
    re.I,
)
date_token_regex = (
    r"(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
    r"[a-z]*\.?\s+)?(?:20\d{2}|19\d{2})"
)
date_range_pattern = re.compile(
    rf"(?P<start>{date_token_regex})\s*[-–—]\s*"
    rf"(?P<end>(?:present|current|actualidad|presente|now|{date_token_regex}))",
    re.I,
)
single_year_pattern = re.compile(r"\b(20\d{2}|19\d{2})\b")
bullet_prefix_pattern = re.compile(r"^\s*(?:[-*•▪●‣·]|\\u2022)\s*")
label_value_pattern = re.compile(r"^\s*([^:]{2,40}):\s*(.+)$")
present_date_tokens = {"actualidad", "current", "now", "present", "presente"}


@dataclass(frozen=True)
class PdfImportResult:
    """Structured result of PDF text extraction and YAML conversion."""

    yaml: str
    extracted_text: str
    line_count: int
    warnings: list[str]
    detected_fields: list[str]
    unrecognized_lines: list[str]


def normalize_line(line: str) -> str:
    """Normalize one extracted PDF text line."""
    without_controls = "".join(
        char if char == "\t" or char == "\n" or ord(char) >= 32 else " "
        for char in line
    )
    normalized = (
        without_controls.replace("\u00a0", " ")
        .replace("\u200b", "")
        .replace("\uf0b7", "•")
        .replace("", "-")
    )
    normalized = bullet_prefix_pattern.sub("", normalized)
    return re.sub(r"\s+", " ", normalized).strip(" \t\r\n•-–—")


def normalize_website(url: str) -> str:
    """Normalize extracted website URL for RenderCV validation."""
    value = url.strip(" \t\r\n,;.)]}>")
    if not re.match(r"https?://", value, re.I):
        return f"https://{value}"
    return value


def extract_pdf_text(pdf_bytes: bytes) -> str:
    """Extract plain text from uploaded PDF bytes.

    Args:
        pdf_bytes: Raw PDF bytes.

    Returns:
        Extracted plain text.

    Raises:
        RenderCVUserError: If the file cannot be parsed or contains no text.
    """
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
    except Exception as error:
        raise RenderCVUserError(message="The uploaded PDF could not be read.") from error

    if len(reader.pages) == 0:
        raise RenderCVUserError(message="The uploaded PDF does not contain pages.")

    page_texts: list[str] = []
    for page in reader.pages[:12]:
        text = page.extract_text() or ""
        if text.strip():
            page_texts.append(text)

    extracted_text = "\n".join(page_texts).strip()
    if not extracted_text:
        raise RenderCVUserError(
            message=(
                "No selectable text was found in the PDF. Scanned image-only PDFs "
                "cannot be converted without OCR."
            )
        )

    return extracted_text


def normalized_lines_from_text(text: str) -> list[str]:
    """Return non-empty normalized lines from extracted text."""
    lines = [normalize_line(line) for line in text.splitlines()]
    return [line for line in lines if line]


def find_first_match(pattern: re.Pattern[str], text: str) -> str:
    """Return first regex match or an empty string."""
    match = pattern.search(text)
    return match.group(0).strip(" ,;") if match else ""


def find_phone(text: str) -> str:
    """Return a plausible phone number from text."""
    for match in phone_pattern.finditer(text):
        candidate = match.group(0).strip(" ,;")
        digits = re.sub(r"\D", "", candidate)
        if re.fullmatch(r"\d{4}[-–]\d{2,4}", candidate):
            continue
        if candidate.startswith("+") and len(digits) >= 8:
            return candidate
        if len(digits) >= 10:
            return candidate
    return ""


def find_rendercv_safe_phone(text: str) -> str:
    """Return a phone number only when it is likely valid for RenderCV."""
    phone = find_phone(text)
    if not phone or not phone.startswith("+"):
        return ""

    try:
        parsed_phone = phonenumbers.parse(phone, None)
    except phonenumbers.NumberParseException:
        return ""

    if not phonenumbers.is_valid_number(parsed_phone):
        return ""

    return phonenumbers.format_number(
        parsed_phone,
        phonenumbers.PhoneNumberFormat.INTERNATIONAL,
    )


def strip_contact_fragments(line: str) -> str:
    """Remove contact data fragments from a line."""
    value = email_pattern.sub("", line)
    phone = find_phone(value)
    if phone:
        value = value.replace(phone, "")
    value = url_pattern.sub("", value)
    value = re.sub(r"\s*[|•·]\s*", " ", value)
    return normalize_line(value)


def looks_like_section_heading(line: str) -> str | None:
    """Return canonical section heading if line looks like a known heading."""
    normalized = line.strip().lower().rstrip(":")
    if normalized in common_section_titles:
        return common_section_titles[normalized]

    compact = re.sub(r"[^a-záéíóúñü ]", "", normalized)
    return common_section_titles.get(compact)


def looks_like_boilerplate(line: str) -> bool:
    """Return true for common PDF footers and page markers."""
    lowered = line.lower()
    if "last updated" in lowered or "updated in" in lowered:
        return True
    return bool(re.search(r"\b\d+\s*/\s*\d+\b", line))


def detect_language(lines: list[str]) -> str:
    """Detect a reasonable RenderCV locale from headings."""
    spanish_markers = {
        "educación",
        "experiencia",
        "habilidades",
        "perfil",
        "proyectos",
        "publicaciones",
        "resumen",
    }
    lowered_lines = {line.lower().strip(":") for line in lines}
    return "spanish" if lowered_lines & spanish_markers else "english"


def looks_like_location(line: str, name: str, headline: str) -> bool:
    """Return true when a header line looks like a location."""
    if line in {name, headline}:
        return False
    if email_pattern.search(line) or url_pattern.search(line) or find_phone(line):
        return False
    if looks_like_section_heading(line) or looks_like_boilerplate(line):
        return False
    location_markers = (
        "remote",
        "remoto",
        "bolivia",
        "usa",
        "united states",
        "canada",
        "méxico",
        "mexico",
        "argentina",
        "colombia",
        "perú",
        "peru",
        "chile",
        "spain",
        "españa",
    )
    lowered = line.lower()
    word_count = len(line.split())
    has_city_country_shape = "," in line and word_count <= 8 and len(line) <= 80
    has_known_location_marker = word_count <= 8 and any(
        marker in lowered for marker in location_markers
    )
    return has_city_country_shape or has_known_location_marker


def looks_like_name(line: str) -> bool:
    """Return true when a line is a plausible person name."""
    lowered = line.lower()
    blocked_fragments = ("page ", " / ")
    if looks_like_boilerplate(line) or any(
        fragment in lowered for fragment in blocked_fragments
    ):
        return False
    if any(char.isdigit() for char in line):
        return False
    if email_pattern.search(line) or find_phone(line) or url_pattern.search(line):
        return False
    if looks_like_section_heading(line):
        return False
    words = line.split()
    if not (2 <= len(words) <= 5):
        return False
    letter_count = sum(char.isalpha() for char in line)
    return letter_count >= max(4, len(line.replace(" ", "")) // 2)


def build_sections(lines: list[str], ignored_line_indexes: set[int]) -> dict[str, list[str]]:
    """Build RenderCV text sections from normalized PDF lines."""
    sections: dict[str, list[str]] = {}
    current_section = "Profile"
    current_section_is_explicit = False
    buffer: list[str] = []

    for index, line in enumerate(lines):
        heading = looks_like_section_heading(line)
        if heading:
            if buffer:
                sections.setdefault(current_section, []).extend(buffer)
                buffer = []
            current_section = heading
            current_section_is_explicit = True
            continue

        if index in ignored_line_indexes:
            continue

        cleaned_line = strip_contact_fragments(line)
        if not cleaned_line:
            continue
        if looks_like_boilerplate(cleaned_line):
            continue
        if (
            current_section == "Profile"
            and not current_section_is_explicit
            and looks_like_name(cleaned_line)
        ):
            continue

        buffer.append(cleaned_line)

    if buffer:
        sections.setdefault(current_section, []).extend(buffer)

    return {
        title: entries[:24]
        for title, entries in sections.items()
        if any(entry.strip() for entry in entries)
    }


def normalize_date_token(token: str) -> str:
    """Normalize extracted date token to a RenderCV-safe value."""
    cleaned = normalize_line(token).lower().rstrip(".")
    if cleaned in present_date_tokens:
        return "present"

    year_match = single_year_pattern.search(cleaned)
    return year_match.group(1) if year_match else cleaned


def split_date_range(line: str) -> tuple[str, str, str]:
    """Extract start/end dates and return line without date range."""
    match = date_range_pattern.search(line)
    if match is None:
        return "", "", line

    start = normalize_date_token(match.group("start"))
    normalized_end = normalize_date_token(match.group("end"))
    cleaned = normalize_line(line[: match.start()] + " " + line[match.end() :])
    return start, normalized_end, cleaned


def split_label_value(line: str) -> tuple[str, str] | None:
    """Split a label-value line such as `Company: Acme`."""
    match = label_value_pattern.match(line)
    if match is None:
        return None
    return match.group(1).strip().lower(), match.group(2).strip()


def split_name_and_organization(line: str) -> tuple[str, str, str]:
    """Parse common `Role at Company` text."""
    start_date, end_date, cleaned = split_date_range(line)
    match = re.match(r"(.+?)\s+(?:at|en|@)\s+(.+)$", cleaned, re.I)
    if match is None:
        match = re.match(r"(.+?)\s+[-–—]\s+(.+)$", cleaned)
    if match is None:
        return "", "", cleaned
    return (
        match.group(1).strip(" ,"),
        match.group(2).strip(" ,"),
        f"{start_date}|{end_date}",
    )


def split_degree_area(line: str) -> tuple[str, str] | None:
    """Split common degree plus area lines."""
    degree_names = (
        "BA",
        "BS",
        "BSc",
        "Bachelor",
        "Engineer",
        "Lic",
        "Licenciatura",
        "MA",
        "MS",
        "MSc",
        "PhD",
    )
    degree_pattern = "|".join(re.escape(degree) for degree in degree_names)
    match = re.match(
        rf"(?P<degree>{degree_pattern})\.?\s+(?:in\s+|en\s+)?(?P<area>.+)$",
        line,
        re.I,
    )
    if match is None:
        return None
    return match.group("degree"), match.group("area").strip()


def compact_highlights(lines: list[str]) -> list[str]:
    """Return cleaned highlights with noise removed."""
    highlights: list[str] = []
    for line in lines:
        cleaned_line = normalize_line(line)
        if cleaned_line and not looks_like_boilerplate(cleaned_line):
            highlights.append(cleaned_line)
    return highlights[:12]


def build_experience_entries(lines: list[str]) -> list[dict[str, object]] | list[str]:
    """Build structured experience entries when possible."""
    if not lines:
        return []

    entries: list[dict[str, object]] = []
    current: dict[str, object] = {}
    highlights: list[str] = []

    def flush_current() -> None:
        nonlocal current, highlights
        if not current and not highlights:
            return
        if "company" not in current and highlights:
            current["company"] = highlights.pop(0)
        if "position" not in current:
            current["position"] = "Role"
        if highlights:
            current["highlights"] = compact_highlights(highlights)
        if "company" in current:
            entries.append(current)
        current = {}
        highlights = []

    for line in lines:
        label_value = split_label_value(line)
        if label_value is not None:
            label, value = label_value
            if label in {"company", "empresa", "organization", "organización"}:
                if current:
                    flush_current()
                current["company"] = value
                continue
            if label in {"position", "role", "cargo", "title"}:
                current["position"] = value
                continue
            if label in {"location", "lugar", "ubicación", "ubicacion"}:
                current["location"] = value
                continue
            if label in {"date", "fecha"}:
                current["date"] = value
                continue

        parsed_position, parsed_company, dates = split_name_and_organization(line)
        if parsed_position and parsed_company:
            if current:
                flush_current()
            current["position"] = parsed_position
            current["company"] = parsed_company
            start_date, end_date = dates.split("|", 1)
            if start_date:
                current["start_date"] = start_date
            if end_date:
                current["end_date"] = end_date
            continue

        start_date, end_date, cleaned = split_date_range(line)
        if start_date or end_date:
            if start_date:
                current["start_date"] = start_date
            if end_date:
                current["end_date"] = end_date
            if cleaned:
                highlights.append(cleaned)
            continue

        single_year_match = single_year_pattern.fullmatch(line)
        if single_year_match is not None:
            current["date"] = single_year_match.group(1)
            continue

        if (
            "company" in current
            and "position" in current
            and highlights
            and len(line.split()) <= 6
            and not line.endswith(".")
        ):
            flush_current()
            current["company"] = line
            continue

        if "company" not in current and len(line.split()) <= 8:
            current["company"] = line
            continue
        if "position" not in current and len(line.split()) <= 8:
            current["position"] = line
            continue
        highlights.append(line)

    flush_current()
    return entries if entries else lines


def build_education_entries(lines: list[str]) -> list[dict[str, object]] | list[str]:
    """Build structured education entries when possible."""
    if not lines:
        return []

    entry: dict[str, object] = {}
    highlights: list[str] = []
    for line in lines:
        label_value = split_label_value(line)
        if label_value is not None:
            label, value = label_value
            if label in {"institution", "university", "school", "institución"}:
                entry["institution"] = value
                continue
            if label in {"area", "field", "major", "área"}:
                entry["area"] = value
                continue
            if label in {"degree", "título"}:
                entry["degree"] = value
                continue

        single_year_match = single_year_pattern.fullmatch(line)
        if single_year_match is not None:
            entry["date"] = single_year_match.group(1)
            continue

        degree_area = split_degree_area(line)
        if degree_area is not None and "area" not in entry:
            degree, area = degree_area
            entry["degree"] = degree
            entry["area"] = area
            continue

        start_date, end_date, cleaned = split_date_range(line)
        if start_date:
            entry["start_date"] = start_date
        if end_date:
            entry["end_date"] = end_date
        if cleaned and (start_date or end_date):
            highlights.append(cleaned)
        elif "institution" not in entry:
            entry["institution"] = line
        elif "area" not in entry:
            entry["area"] = line
        else:
            highlights.append(line)

    if "institution" not in entry:
        return lines
    if "area" not in entry:
        entry["area"] = "Field of study"
    if highlights:
        entry["highlights"] = compact_highlights(highlights)
    return [entry]


def build_one_line_entries(lines: list[str], fallback_label: str) -> list[dict[str, str]]:
    """Build one-line entries for skills and language-like sections."""
    entries: list[dict[str, str]] = []
    unlabelled: list[str] = []
    for line in lines:
        label_value = split_label_value(line)
        if label_value is not None:
            label, value = label_value
            entries.append({"label": label.title(), "details": value})
        else:
            unlabelled.append(line)

    if unlabelled:
        entries.append({"label": fallback_label, "details": ", ".join(unlabelled)})
    return entries


def has_sentence_terminal_punctuation(text: str) -> bool:
    """Return true when text looks like a complete sentence."""
    return text.strip().endswith((".", "!", "?"))


def starts_with_lowercase_letter(text: str) -> bool:
    """Return true when the first alphabetic character is lowercase."""
    first_letter = next((char for char in text.strip() if char.isalpha()), "")
    return bool(first_letter and first_letter.islower())


def looks_like_normal_entry_title(line: str) -> bool:
    """Return true when a line looks like a project/research item title."""
    cleaned = line.strip()
    return (
        bool(cleaned)
        and len(cleaned.split()) <= 8
        and not has_sentence_terminal_punctuation(cleaned)
        and not starts_with_lowercase_letter(cleaned)
    )


def should_merge_wrapped_normal_line(previous: str, current: str) -> bool:
    """Return true when a short PDF line is a continuation of previous text."""
    if not previous.strip() or not current.strip():
        return False
    return (
        not has_sentence_terminal_punctuation(previous)
        and starts_with_lowercase_letter(current)
    )


def build_normal_entries(lines: list[str]) -> list[dict[str, object]]:
    """Build normal entries for projects and similar sections."""
    entries: list[dict[str, object]] = []
    current_name = ""
    current_highlights: list[str] = []

    def flush_current() -> None:
        nonlocal current_name, current_highlights
        if not current_name and not current_highlights:
            return
        entry: dict[str, object] = {"name": current_name or current_highlights.pop(0)}
        if current_highlights:
            entry["highlights"] = compact_highlights(current_highlights)
        entries.append(entry)
        current_name = ""
        current_highlights = []

    for line in lines:
        if not current_name:
            current_name = line
            continue

        if current_highlights and should_merge_wrapped_normal_line(
            current_highlights[-1],
            line,
        ):
            current_highlights[-1] = f"{current_highlights[-1]} {line}"
            continue

        if current_highlights and looks_like_normal_entry_title(line):
            flush_current()
            current_name = line
            continue

        current_highlights.append(line)

    flush_current()
    return entries


def join_paragraph_lines(lines: list[str]) -> str:
    """Join wrapped PDF lines into one editable paragraph."""
    return " ".join(line.strip() for line in lines if line.strip())


def build_section_entries(title: str, lines: list[str]) -> object:
    """Convert section text lines into RenderCV entry objects."""
    lowered = title.lower()
    if lowered in {"summary", "resumen", "profile", "perfil"}:
        paragraph = join_paragraph_lines(lines)
        return [paragraph] if paragraph else []
    if lowered in {"experience", "experiencia"}:
        return build_experience_entries(lines)
    if lowered in {"education", "educación"}:
        return build_education_entries(lines)
    if lowered in {"skills", "habilidades"}:
        return build_one_line_entries(lines, "Skills")
    if lowered == "languages":
        return build_one_line_entries(lines, "Languages")
    if lowered in {"projects", "proyectos", "research"}:
        return build_normal_entries(lines)
    if lowered in {"awards", "honors", "certifications"}:
        return [{"bullet": line} for line in lines[:24]]
    return lines[:24]


def build_social_networks(text: str, lines: list[str]) -> list[dict[str, str]]:
    """Extract supported social network usernames from text."""
    social_networks: list[dict[str, str]] = []

    linkedin_match = linkedin_pattern.search(text)
    if linkedin_match:
        social_networks.append(
            {"network": "LinkedIn", "username": linkedin_match.group(1).strip("/")}
        )

    github_match = github_pattern.search(text)
    if github_match:
        social_networks.append(
            {"network": "GitHub", "username": github_match.group(1).strip("/")}
        )

    existing_networks = {entry["network"] for entry in social_networks}
    for index, line in enumerate(lines):
        lowered = line.lower().rstrip(":")
        if lowered == "linkedin" and "LinkedIn" not in existing_networks:
            next_line = lines[index + 1] if index + 1 < len(lines) else ""
            if next_line and " " not in next_line:
                social_networks.append({"network": "LinkedIn", "username": next_line})
                existing_networks.add("LinkedIn")
        if lowered == "github" and "GitHub" not in existing_networks:
            next_line = lines[index + 1] if index + 1 < len(lines) else ""
            if next_line and " " not in next_line:
                social_networks.append({"network": "GitHub", "username": next_line})
                existing_networks.add("GitHub")

    return social_networks


def find_contact_line_indexes(lines: list[str]) -> set[int]:
    """Find lines that primarily contain contact information."""
    indexes: set[int] = set()
    for index, line in enumerate(lines[:12]):
        has_contact = email_pattern.search(line) or url_pattern.search(line)
        phone = find_phone(line)
        line_without_phone = line.replace(phone, "") if phone else line
        phone_only = bool(phone) and not any(char.isalpha() for char in line_without_phone)
        if has_contact or phone_only:
            indexes.add(index)
    return indexes


def build_cv_dictionary(text: str) -> dict[str, object]:
    """Build a RenderCV-compatible dictionary from extracted PDF text."""
    lines = normalized_lines_from_text(text)
    if not lines:
        raise RenderCVUserError(message="The PDF did not contain usable text.")

    searchable_text = "\n".join(lines)
    email = find_first_match(email_pattern, searchable_text)
    phone = find_rendercv_safe_phone(searchable_text)
    urls = [
        normalize_website(match.group(0))
        for match in url_pattern.finditer(searchable_text)
    ]
    website_candidates = [
        url
        for url in urls
        if "linkedin.com" not in url.lower() and "github.com" not in url.lower()
    ]
    website = (website_candidates or urls or [""])[0]
    contact_line_indexes = find_contact_line_indexes(lines)

    name_index = next(
        (index for index, line in enumerate(lines[:8]) if looks_like_name(line)),
        -1,
    )
    name = lines[name_index] if name_index >= 0 else "Imported CV"
    headline = ""
    location = ""
    header_ignored_indexes = set(contact_line_indexes)
    if name_index >= 0:
        header_ignored_indexes.add(name_index)

    header_end_index = next(
        (
            index
            for index, line in enumerate(lines[:12])
            if looks_like_section_heading(line)
        ),
        min(len(lines), 12),
    )
    header_candidates: list[tuple[int, str]] = []
    for index, line in enumerate(lines[:header_end_index]):
        cleaned_line = strip_contact_fragments(line)
        if (
            cleaned_line
            and cleaned_line != name
            and not looks_like_boilerplate(cleaned_line)
            and not looks_like_section_heading(cleaned_line)
        ):
            header_candidates.append((index, cleaned_line))

    for index, cleaned_line in header_candidates:
        if index in header_ignored_indexes:
            continue
        if looks_like_location(cleaned_line, name, ""):
            location = cleaned_line
            header_ignored_indexes.add(index)
            break

    for index, cleaned_line in header_candidates:
        if index in header_ignored_indexes:
            continue
        if not looks_like_location(cleaned_line, name, ""):
            headline = cleaned_line
            header_ignored_indexes.add(index)
            break

    cv: dict[str, object] = {"name": name}
    if headline:
        cv["headline"] = headline
    if location:
        cv["location"] = location
    if email:
        cv["email"] = email
    if phone:
        cv["phone"] = phone
    if website:
        cv["website"] = website

    social_networks = build_social_networks(searchable_text, lines)
    if social_networks:
        cv["social_networks"] = social_networks

    ignored_line_indexes = header_ignored_indexes | contact_line_indexes
    sections_raw = build_sections(lines, ignored_line_indexes)
    sections: dict[str, object] = {}
    for title, entries in sections_raw.items():
        section_entries = build_section_entries(title, entries)
        if isinstance(section_entries, list) and section_entries:
            sections[title] = section_entries

    if not sections:
        sections = {
            "Profile": [
                line
                for index, line in enumerate(lines[:12])
                if index not in ignored_line_indexes
            ]
        }
    cv["sections"] = sections

    return {
        "cv": cv,
        "design": {"theme": "classic"},
        "locale": {"language": detect_language(lines)},
    }


def collect_detected_fields(data: dict[str, object]) -> list[str]:
    """Return user-facing fields confidently mapped from extracted text."""
    cv = data.get("cv")
    if not isinstance(cv, dict):
        return []

    fields: list[str] = []
    for field in ("name", "headline", "location", "email", "phone", "website"):
        if field in cv:
            fields.append(field)

    social_networks = cv.get("social_networks")
    if isinstance(social_networks, list) and social_networks:
        fields.append("social_networks")

    sections = cv.get("sections")
    if isinstance(sections, dict):
        fields.extend(
            f"section:{title}" for title in sections if isinstance(title, str)
        )

    return fields


def looks_like_unrecognized_section_heading(line: str, index: int) -> bool:
    """Return true for heading-shaped lines not mapped to known sections."""
    if index < 2:
        return False

    candidate = line.strip().rstrip(":")
    if not candidate or looks_like_section_heading(candidate):
        return False
    if looks_like_boilerplate(candidate):
        return False
    if email_pattern.search(candidate) or find_phone(candidate) or url_pattern.search(candidate):
        return False
    if single_year_pattern.fullmatch(candidate):
        return False

    words = candidate.split()
    if not (1 <= len(words) <= 5):
        return False

    is_marked_heading = line.strip().endswith(":") or candidate.isupper()
    return is_marked_heading and any(char.isalpha() for char in candidate)


def collect_unrecognized_lines(lines: list[str]) -> list[str]:
    """Return likely useful lines that the importer could not classify."""
    unrecognized: list[str] = []

    for index, line in enumerate(lines):
        if url_pattern.search(line) or email_pattern.search(line) or find_phone(line):
            continue

        label_value = split_label_value(line)
        if label_value is not None:
            label, _value = label_value
            if (
                label not in known_label_names
                and label not in common_section_titles
                and not looks_like_section_heading(label)
            ):
                unrecognized.append(line)
                continue

        if looks_like_unrecognized_section_heading(line, index):
            unrecognized.append(line)

    return list(dict.fromkeys(unrecognized))[:12]


def collect_import_warnings(
    data: dict[str, object],
    lines: list[str],
    unrecognized_lines: list[str],
) -> list[str]:
    """Return clear recovery notes for uncertain PDF import results."""
    cv = data.get("cv")
    if not isinstance(cv, dict):
        return ["No se pudo reconocer una estructura de CV completa."]

    warnings: list[str] = []
    if "email" not in cv:
        warnings.append("No se detectó correo electrónico.")
    if "phone" not in cv:
        warnings.append("No se detectó teléfono válido con código de país.")
    if "headline" not in cv:
        warnings.append("No se detectó headline/cargo principal.")

    sections = cv.get("sections")
    if not isinstance(sections, dict) or not sections:
        warnings.append("No se reconocieron secciones editables del CV.")

    if len(lines) <= 4:
        warnings.append("El PDF contiene poco texto seleccionable; revisa el YAML generado.")

    if unrecognized_lines:
        warnings.append(
            "Hay líneas dudosas que conviene revisar antes de exportar el CV."
        )

    return warnings


def build_import_metadata(
    data: dict[str, object],
    lines: list[str],
) -> tuple[list[str], list[str], list[str]]:
    """Build PDF import review metadata for the frontend."""
    detected_fields = collect_detected_fields(data)
    unrecognized_lines = collect_unrecognized_lines(lines)
    warnings = collect_import_warnings(data, lines, unrecognized_lines)
    return warnings, detected_fields, unrecognized_lines


def dump_yaml(data: dict[str, object]) -> str:
    """Serialize a dictionary as block-style YAML."""
    yaml = YAML()
    yaml.default_flow_style = False
    yaml.indent(mapping=2, sequence=4, offset=2)
    yaml.width = 1000
    stream = io.StringIO()
    yaml.dump(data, stream)
    return stream.getvalue()


def convert_pdf_to_yaml(pdf_bytes: bytes) -> PdfImportResult:
    """Extract text from a PDF and convert it into editable RenderCV YAML."""
    extracted_text = extract_pdf_text(pdf_bytes)
    lines = normalized_lines_from_text(extracted_text)
    data = build_cv_dictionary(extracted_text)
    warnings, detected_fields, unrecognized_lines = build_import_metadata(data, lines)
    yaml = dump_yaml(data)

    return PdfImportResult(
        yaml=yaml,
        extracted_text="\n".join(lines),
        line_count=len(lines),
        warnings=warnings,
        detected_fields=detected_fields,
        unrecognized_lines=unrecognized_lines,
    )


def convert_text_to_yaml(text: str) -> PdfImportResult:
    """Convert already extracted text into editable RenderCV YAML."""
    lines = normalized_lines_from_text(text)
    if not lines:
        raise RenderCVUserError(message="The PDF did not contain usable text.")

    data = build_cv_dictionary(text)
    warnings, detected_fields, unrecognized_lines = build_import_metadata(data, lines)
    yaml = dump_yaml(data)
    return PdfImportResult(
        yaml=yaml,
        extracted_text="\n".join(lines),
        line_count=len(lines),
        warnings=warnings,
        detected_fields=detected_fields,
        unrecognized_lines=unrecognized_lines,
    )
