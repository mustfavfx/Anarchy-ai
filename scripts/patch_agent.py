import os

def patch_config_and_agent():
    # 1. Patch config.py for with_fallbacks
    cfg_path = r"E:\Agent\src\config.py"
    if os.path.exists(cfg_path):
        with open(cfg_path, "r", encoding="utf-8") as f:
            cfg = f.read()
        target_gemini = """        return ChatGoogleGenerativeAI(
            model=GEMINI_MODEL,
            temperature=temperature,
            google_api_key=GEMINI_API_KEY
        )"""
        fallback_gemini = """        primary = ChatGoogleGenerativeAI(
            model=GEMINI_MODEL,
            temperature=temperature,
            google_api_key=GEMINI_API_KEY
        )
        return primary.with_fallbacks([ArchitecturalDemoChatModel(temperature=temperature)])"""
        if target_gemini in cfg:
            cfg = cfg.replace(target_gemini, fallback_gemini, 1)
            with open(cfg_path, "w", encoding="utf-8") as f:
                f.write(cfg)
            print("Successfully added with_fallbacks to E:\\Agent\\src\\config.py")
        else:
            print("Target Gemini block not found or already patched")

if __name__ == "__main__":
    patch_config_and_agent()
