import os

def patch_english_config():
    cfg_path = r"E:\Agent\src\config.py"
    if not os.path.exists(cfg_path):
        print("config.py not found")
        return

    with open(cfg_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace demo class with English responses
    old_class_start = "class ArchitecturalDemoChatModel(Runnable):"
    
    english_class = """class ArchitecturalDemoChatModel(Runnable):
    \"\"\"
    Built-in fallback reasoning model when external API keys are not yet configured or rate-limited.
    Provides realistic, professional English architectural responses.
    \"\"\"
    def __init__(self, temperature: float = 0.2):
        self.temperature = temperature

    def invoke(self, input, config=None, **kwargs):
        from langchain_core.messages import AIMessage
        text = str(input)
        
        # Spatial Planning response
        if "Spatial" in text or "Program" in text or "Zoning" in text or "رئيس قسم التخطيط" in text:
            content = (
                "### Spatial & Program Architectural Planning:\\n\\n"
                "1. **[Space Program Matrix & Functional Zoning]**:\\n"
                "   - **Public Zone**: Grand Reception Foyer (35 m²), Formal Dining Salon (24 m²), Double-Height Atrium with Panoramic Water Feature (20 m²).\\n"
                "   - **Semi-Private Zone**: Family Living Lounge overlooking Landscaped Courtyard (45 m²), Gourmet Show Kitchen & Pantry (28 m²).\\n"
                "   - **Private Zone (First Floor)**: Master Suite with Walk-in Dressing & Private Terrace (40 m²), 3 Ensuite Family Bedrooms (25 m² each).\\n\\n"
                "2. **[Circulation & Spatial Topology]**:\\n"
                "   - Primary Guest Entry with Monolithic Stone Portal; Private Family Access via Landscaped Porte-Cochere.\\n\\n"
                "3. **[Environmental & Passive Solar Orientation]**:\\n"
                "   - North-East glazed facade orientation to harvest soft diffused daylight while mitigating thermal solar gain."
            )
            return AIMessage(content=content)

        # Code Compliance response
        elif "Compliance" in text or "كود" in text or "Code" in text or "Setbacks" in text:
            content = (
                "### Regulatory Building Code & Compliance Audit:\\n"
                "- Floor Area Ratio (FAR): 0.58 / Allowed: 0.60 [COMPLIANT]\\n"
                "- Municipal Setbacks: Front: 3.5m | Side: 2.0m | Rear: 2.5m [COMPLIANT]\\n"
                "- Window-to-Wall Ratio (WWR): 32% (Optimized for thermal insulation)\\n"
                "- Natural Ventilation: 100% of habitable rooms exceed municipal fresh air requirements.\\n\\n"
                "AUDIT VERDICT: [COMPLIANT] The architectural proposal adheres strictly to municipal and structural building regulations."
            )
            return AIMessage(content=content)

        # Prompt Synthesis response
        elif "Prompt" in text or "Negative" in text or "برومبت" in text:
            content = (
                "[ENHANCED_PROMPT]: Architectural photograph of a modern luxury villa, beige travertine stone cladding, floor-to-ceiling double-glazed minimalist windows, illuminated internal courtyard with reflective pool, architectural soft daylighting, shot on 35mm lens, photorealistic 8k, highly detailed exterior render.\\n\\n"
                "[NEGATIVE_PROMPT]: blurry, distorted lines, warped walls, oversaturated, low quality, unrealistic proportions, structural errors.\\n\\n"
                "[RECOMMENDED_SETTINGS]: Aspect Ratio 16:9 | Photorealistic Render | High Detail\\n\\n"
                "[EXECUTIVE_SUMMARY]: The comprehensive architectural spatial program has been synthesized in full compliance with municipal zoning guidelines, integrating client specifications into high-fidelity render prompts."
            )
            return AIMessage(content=content)

        # Generic fallback
        return AIMessage(content="Architectural design workflow processed successfully according to professional engineering standards.")

    def __or__(self, other):
        return self"""

    # Find the class and replace it up to get_llm
    if old_class_start in content and "def get_llm" in content:
        before = content.split(old_class_start)[0]
        after = "def get_llm" + content.split("def get_llm")[1]
        new_content = before + english_class + "\n\n" + after
        with open(cfg_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print("Successfully updated config.py with 100% English architectural responses!")
    else:
        print("Could not match class in config.py")

if __name__ == "__main__":
    patch_english_config()
