import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(error.code==='ERR_MODULE_NOT_FOUND'&&(/^(\.\.?\/|file:)/.test(specifier))&&!/\.[a-z0-9]+$/i.test(specifier))return next(specifier+'.ts',context);throw error;}}});
