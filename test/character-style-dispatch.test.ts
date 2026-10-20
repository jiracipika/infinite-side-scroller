import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '@/game/data/characters';
import { ensureCharacterSheetsLoading, characterSheetReady, drawCharacterSheet, setPreferredArtStyle } from '@/game/rendering/sprite-sheet';

describe('loaded-image style dispatch regression',()=>{
  it('Ink never silently paints Pixel after images load; Pixel explicitly does',()=>{
    const previous=globalThis.Image;
    class LoadedImage {
      onload:(()=>void)|null=null;
      set src(_value:string){this.onload?.();}
    }
    globalThis.Image=LoadedImage as unknown as typeof Image;
    try{
      ensureCharacterSheetsLoading();
      let draws=0;
      const ctx={drawImage(){draws++;},imageSmoothingEnabled:true} as unknown as CanvasRenderingContext2D;
      for(const char of CHARACTERS){
        assert.equal(characterSheetReady(char.id),true);
        setPreferredArtStyle(char.id,'ink');
        assert.equal(drawCharacterSheet(ctx,char.id,char.width,char.height),false,`${char.id}: default Ink`);
        setPreferredArtStyle(char.id,'pixel');
        assert.equal(drawCharacterSheet(ctx,char.id,char.width,char.height),true,`${char.id}: explicit Pixel`);
        setPreferredArtStyle(char.id,'ink');
        assert.equal(drawCharacterSheet(ctx,char.id,char.width,char.height),false,`${char.id}: switch back`);
      }
      assert.equal(draws,CHARACTERS.length);
    }finally{globalThis.Image=previous;}
  });
});
